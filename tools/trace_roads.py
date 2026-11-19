"""Derive the community road graph. Run with the pinned 10k basemap, GTADB snapshot and output JS path.
Python dependencies: Pillow, NumPy, SciPy, scikit-image, NetworkX. Sources and revisions are in the output.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from reviewed_roads import add_reviewed
import networkx as nx
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

LEFT, TOP = 2500, 500
ORIGIN_X, ORIGIN_Y = 384 + LEFT*2, 4384 + TOP*2
STRIDE = 7500
SOURCE = 'https://github.com/navanem/gta6-leonida-atlas/blob/main/public/assets/gta6-leonida-atlas/basemap.webp'
UPSTREAM = 'https://github.com/rolux/gtadb.org/tree/7c3f8c295d64254e6b6d269b77c6f84fc4339f9c/maps'

def raster_point(x, y):
    return (x-ORIGIN_X)/2, (y-ORIGIN_Y)/2

def road_pixels(pixels):
    red, green, blue = [pixels[:,:,i] for i in range(3)]
    # Only retain the light road palette. Coastlines, sand, parcel boundaries and
    # building outlines are common false positives in relaxed local-contrast masks.
    mask = (red >= 233) & (green >= 226) & (blue >= 201)
    for start in range(0,len(mask),500):
        end=min(start+500,len(mask)); low=max(0,start-10)
        r,g,b=[c[low:end+10].astype('int16') for c in (red,green,blue)]
        water=(b>r+15)&(b>=g+4)
        mask[start:end] &= ~ndi.maximum_filter(water,size=17)[start-low:end-low]
    mask=ndi.binary_opening(mask,structure=np.array([[0,1,0],[1,1,1],[0,1,0]],bool))
    # These paved surfaces are airport ramps, taxiways and runways, not through streets.
    airfields=[
        [(12750,16470),(14290,16538),(14442,16644),(14402,16852),(14100,16822),(13805,16832),(13615,17215),(14177,17650),(14336,17716),(14210,17910),(12710,17000)],
        [(8540,23365),(9160,22570),(9175,22280),(9440,22230),(9740,23285),(9680,23510),(9110,22920),(8730,23445)],
    ]
    im=Image.fromarray(mask)
    pen=ImageDraw.Draw(im)
    for poly in airfields:
        pen.polygon([raster_point(x,y) for x,y in poly],fill=0)
    mask=np.array(im)
    labs,_=ndi.label(mask,np.ones((3,3),bool))
    sizes=np.bincount(labs.ravel());sizes[0]=0
    return skeletonize(sizes[labs]>150)

def make_graph(skel):
    raw=set(map(int,np.flatnonzero(skel)))
    graph=nx.Graph()
    for v in raw:
        for shift in (1,STRIDE,STRIDE-1,STRIDE+1):
            w=v+shift
            if w not in raw:continue
            # Remove pixel triangles at ordinary corners, retaining true T junctions.
            if shift>1 and shift!=STRIDE and (v+STRIDE in raw or w-STRIDE in raw):continue
            graph.add_edge(v,w)
    return graph

def pixel(v):
    return np.array([v%STRIDE,v//STRIDE],dtype=float)

def direction(graph,v,neighbor,steps):
    last=v; end=neighbor
    for _ in range(steps):
        options=list(graph[end])
        if len(options)!=2:break
        nxt=options[1] if options[0]==last else options[0]
        last,end=end,nxt
    d=pixel(end)-pixel(v)
    return d/(np.linalg.norm(d) or 1)

def patch_short_gaps(graph,pixels):
    ends=[v for v,d in graph.degree if d==1]
    pts=np.array([pixel(v) for v in ends])
    candidates=cKDTree(pts).query_pairs(18)
    facing=[-direction(graph,v,next(iter(graph[v])),7) for v in ends]
    joined=set();total=0
    for i,j in sorted(candidates,key=lambda ij:np.linalg.norm(pts[ij[0]]-pts[ij[1]])):
        if i in joined or j in joined:continue
        vec=pts[j]-pts[i];length=np.linalg.norm(vec)
        if length<2:continue
        delta=vec/length
        if np.dot(facing[i],delta)<0.89 or np.dot(facing[j],-delta)<0.89:continue
        samples=np.rint(np.linspace(pts[i],pts[j],math.ceil(length)+1)).astype(int)
        colors=pixels[samples[:,1],samples[:,0]].astype('int16')
        # Reconnect only a short, collinear break with bright supporting pavement throughout.
        # Never bridge blue water, vegetation or a road cut for a level-separated crossing.
        r,g,b=colors.T
        if min(r)<166 or any((b>r)|(g>r+2)) or np.mean(r>=193)<0.87:continue
        if graph.has_edge(ends[i],ends[j]):continue
        graph.add_edge(ends[i],ends[j]);joined.update((i,j));total+=1
    return total

def paths_between_junctions(graph):
    seen=set();paths=[]
    def walk(v,w):
        route=[v,w];seen.add(tuple(sorted((v,w))))
        while graph.degree[w]==2:
            nxt=next(a for a in graph[w] if a!=v);edge=tuple(sorted((w,nxt)))
            if edge in seen:break
            seen.add(edge);route.append(nxt);v,w=w,nxt
        paths.append(route)
    for v,d in graph.degree:
        if d!=2:
            for w in graph[v]:
                if tuple(sorted((v,w))) not in seen:walk(v,w)
    for v,w in graph.edges:
        if tuple(sorted((v,w))) not in seen:walk(v,w)
    return paths

def simplify(chain):
    # Subdivide long straight portions, then apply a 2m Douglas–Peucker tolerance.
    def rdp(p):
        if len(p)<=2:return p
        chord=p[-1]-p[0];den=float(chord@chord)
        t=np.clip((p-p[0])@chord/(den or 1),0,1)
        residual=np.linalg.norm(p-(p[0]+t[:,None]*chord),axis=1)
        i=int(np.argmax(residual))
        if residual[i]<=1:return p[[0,-1]]
        return np.concatenate([rdp(p[:i+1])[:-1],rdp(p[i:])])
    points=np.array([pixel(v) for v in chain])
    parts=[points[0]]
    index=0;dist=0
    for i in range(1,len(points)):
        dist+=np.linalg.norm(points[i]-points[i-1])
        if dist>=15 or i==len(points)-1:
            parts.extend(rdp(points[index:i+1])[1:]);index=i;dist=0
    return [tuple(p) for p in parts]

def bridge_sites(catalog):
    sites=[]
    for r in catalog['landmarks']:
        a=r['inGameAddress'].split(',')[0]
        if r['inGameCoordinates'] and re.search(r'\b(bridge|overpass|viaduct|interchange|flyover|tunnel)\b',a,re.I):
            x,y=r['inGameCoordinates'];sites.append(raster_point(x+16384,16384-y))
    return cKDTree(sites)

def protect_crossings(graph,tagged):
    # Treat four-arm crossings close to published bridge/overpass locations as straight-through
    # when the two locally straight axes are unambiguous. Never invent crossing turns there.
    separated=0
    for node in list(graph):
        if graph.degree(node)!=4:continue
        point=np.array(node[:2]);distance=tagged.query(point)[0]
        if distance>60:continue
        adj=list(graph[node]);vec=[]
        for other in adj:
            q=np.array(other[:2])-point
            vec.append(q/(np.linalg.norm(q) or 1))
        pairs=[((0,1),(2,3)),((0,2),(1,3)),((0,3),(1,2))]
        best=min(pairs,key=lambda pair:sum(vec[i]@vec[j] for i,j in pair))
        if any(vec[i]@vec[j]>-.77 for i,j in best):continue
        second=node+(1,)
        for i in best[1]:
            graph.remove_edge(node,adj[i]);graph.add_edge(second,adj[i])
        separated+=1
    return separated

def main():
    args=argparse.ArgumentParser()
    args.add_argument('basemap',type=Path);args.add_argument('snapshot',type=Path);args.add_argument('output',type=Path)
    a=args.parse_args()
    blob=a.basemap.read_bytes()
    assert hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()=='755954b816ca52d4a4ea113c57e040c51b7462e9'
    Image.MAX_IMAGE_PIXELS=120000000
    pixels=np.asarray(Image.open(a.basemap).crop((LEFT,TOP,10000,10000)).convert('RGB'))
    cat=json.loads(a.snapshot.read_text())
    graph=make_graph(road_pixels(pixels))
    fixed=patch_short_gaps(graph,pixels)
    print('traced',len(graph),fixed,'collinear gaps',flush=True)
    for group in list(nx.connected_components(graph)):
        if len(group)<130:graph.remove_nodes_from(group)
    out=nx.Graph()
    for c in paths_between_junctions(graph):
        if len(c)<=4 and (graph.degree[c[0]]==1 or graph.degree[c[-1]]==1):continue
        path=simplify(c);out.add_edges_from(zip(path,path[1:]))
    separated=protect_crossings(out,bridge_sites(cat))
    # Keep the surveyed city and crossing corridors independent of raster-derived edges.
    # Within the urban review area, offer only these manually checked roads.
    for point in list(out):
        raw_x=ORIGIN_X+2*point[0];raw_y=ORIGIN_Y+2*point[1]
        if 15555<raw_x<18760 and 14600<raw_y<17090:
            out.remove_node(point)
    for comp in list(nx.connected_components(out)):
        if len(comp)<24:out.remove_nodes_from(comp)
    traced=add_reviewed(out)
    comps=sorted(nx.connected_components(out),key=len,reverse=True)
    idx={p:i for i,p in enumerate(p for comp in comps for p in sorted(comp))}
    nodes=[[round((ORIGIN_X+2*x-3550)/19,4),round((ORIGIN_Y+2*y-5450)/19,4)] for x,y,*_ in idx]
    edges=[]
    for p,q in out.edges:
        d=2*math.dist(p[:2],q[:2])
        if d>0:edges.append([idx[p],idx[q],round(d,2),0])
    asset={'nodes':nodes,'edges':edges,'metersPerUnit':19,'source':SOURCE,'sourceMap':UPSTREAM,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','credit':'YANIS v16 · GTADB 与社区制图者，基于 navanem 社区底图提取道路中心线','method':'市区选段及两条跨湾通道逐段描绘；其他区域提取底图浅色道路，排除近岸笔画和跑道。各路网分区可能不连通。','limits':'社区估算；道路方向、转向限制、立交层级和车辆通行性未经游戏验证。','componentSizes':[len(c) for c in comps],'straightThroughCrossings':separated,'reviewedCorridors':['Downtown / Bayside','Venetian Causeway','I-395 / MacArthur Causeway','Vice Beach'],'registeredExtent':[3550,5450,22550,24450]}
    a.output.write_text('// YANIS v16 / GTADB and contributors, via navanem · CC BY 4.0. Independently traced, simplified and registered.\nwindow.roadNetwork='+json.dumps(asset,ensure_ascii=False,separators=(',',':'))+';\n')
    print(len(nodes),len(edges),'components',len(comps),'largest',[len(c) for c in comps[:10]],'separated',separated)
if __name__=='__main__':main()
