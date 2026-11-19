"""Read original 256px YANIS v16 tiles and trace their street and motorway symbols.
Usage: python3 trace_source_roads.py TILE_DIRECTORY GTADB_SNAPSHOT OUTPUT_JS
Depends on Pillow, NumPy, SciPy, networkx and scikit-image.
"""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import math
import re

import networkx as nx
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

from reviewed_roads import add_reviewed
from trace_roads import (STRIDE, ORIGIN_X, ORIGIN_Y, UPSTREAM, pixel,
    direction, make_graph, paths_between_junctions, simplify, protect_crossings, bridge_sites)

# Only the original map's neutral road inks belong to these classes. Unlike the
# styled WebP, the JPEGs retain differences between local roads (83), freeways
# (114), runways (99), buildings (176), rail/transit markings and shoreline.
LOCAL, FREEWAY, LAND, WATER, ANNO = 1,2,4,8,16
SIZE=(9500,STRIDE)
TILES_REVISION='7c3f8c295d64254e6b6d269b77c6f84fc4339f9c'
ARCHIVE_REVISION='0c7434f5bd5ed59a58aaa75a3ba7c3734fa0c4d0'
def source_palette(directory):
    mosaic=np.zeros(SIZE,np.uint8)
    digest=hashlib.sha256()
    for y in range(21,96):
        for x in range(21,80):
            p=directory/f'5,{y},{x}.jpg'
            contents=p.read_bytes();digest.update(contents)
            im=np.array(Image.open(p).convert('RGB'),dtype='int16')
            hue=im.max(2)-im.min(2);r,g,b=im[:,:,0],im[:,:,1],im[:,:,2]
            grey=(hue<=17)
            kinds=((grey&(r>=69)&(r<=90)),(grey&(r>=107)&(r<=123)), (grey&(r>=154)&(r<=229)),
                ((b-r>38)&(b-g>8)), ((~grey)&(b-r<39)&(g-b<32)) | (grey&((r<67)|(r>230))))
            tile=np.zeros((128,128),np.uint8)
            for bit,flag in zip((LOCAL,FREEWAY,LAND,WATER,ANNO),kinds):
                # Reduce from 1 m to 2 m only AFTER categorisation. Minimum two
                # observations prevent skinny JPEG color rims becoming a road.
                votes=flag.reshape(128,2,128,2).sum(axis=(1,3))
                tile[votes>=2] |= bit
            i=(256*x-ORIGIN_X)//2;j=(256*y-ORIGIN_Y)//2
            lo=max(0,i);top=max(0,j);ri=min(STRIDE,i+128);bot=min(SIZE[0],j+128)
            if ri>lo and bot>top:mosaic[top:bot,lo:ri]=tile[top-j:bot-j,lo-i:ri-i]
    assert digest.hexdigest()=='4e2626b977e6d91a585c8c3fb9f8e7d0110a79e5c0aa13757919c7bd2ffd64bb', 'Tile contents/order do not match the pinned YANIS v16 basemap'
    return mosaic

def traces(mosaic,bit):
    mask=(mosaic&bit)!=0
    # One pixel-radius closing fills anti-aliased text flecks and seam noise.
    cross=ndi.generate_binary_structure(2,1)
    mask=ndi.binary_closing(mask,structure=cross)
    labels,n=ndi.label(mask,np.ones((3,3),bool))
    keep=np.bincount(labels.ravel())>=52;keep[0]=False
    return make_graph(skeletonize(keep[labels]))

def gap_links(graph,mosaic,bit):
    ends=[v for v,d in graph.degree if d==1]
    xy=np.array([pixel(v) for v in ends])
    arms=np.array([-direction(graph,v,next(iter(graph[v])),10) for v in ends])
    tree=cKDTree(xy);pairs=[]
    for i,j in tree.query_pairs(38):
        gap=xy[j]-xy[i];dist=np.linalg.norm(gap)
        if dist<2:continue
        heading=gap/dist
        if min(arms[i]@heading,arms[j]@(-heading)) < (.83 if dist<9 else .94):continue
        # Opposite tips alone are insufficient. At a grade crossing the other
        # ink may hide the lower road; labels can briefly interrupt either ink.
        pts=np.rint(np.linspace(xy[i],xy[j],math.ceil(dist)+1)).astype(int)
        ink=mosaic[pts[:,1],pts[:,0]]
        cross=FREEWAY if bit==LOCAL else LOCAL
        supported=(ink & (bit|cross|ANNO))!=0
        if np.mean(supported)<(.45 if dist<9 else .69):continue
        if np.sum((ink&WATER)!=0)>1:continue
        if np.sum((ink&LAND)!=0) > max(2,math.ceil(dist*.23)):continue
        # Do not close across an ordinary open block or across a wide median.
        unsupported=np.where(np.diff(np.r_[True,supported,True]))[0]
        if len(unsupported) and (unsupported[1::2]-unsupported[::2]).max()>5:continue
        pairs.append((dist,i,j))
    used=set();n=0
    for _,i,j in sorted(pairs):
        if i in used or j in used:continue
        graph.add_edge(ends[i],ends[j]);used.update([i,j]);n+=1
    return n

def simplified(graph,bit):
    out=nx.Graph()
    for comp in list(nx.connected_components(graph)):
        if len(comp)<55:graph.remove_nodes_from(comp)
    for chain in paths_between_junctions(graph):
        if (graph.degree(chain[0])==1 or graph.degree(chain[-1])==1) and sum(math.dist(pixel(a),pixel(b)) for a,b in zip(chain,chain[1:]))<8:continue
        path=[(x,y,bit) for x,y in simplify(chain)]
        out.add_edges_from(zip(path,path[1:]))
    return out

def validate_freeways(graph,sites):
    # Dual-ink separation already avoids local-to-motorway turns at crossings.
    # In the motorway layer, all clean X crossings are treated as two paths.
    class AllCrossings:
        def query(self,point):return (0,None)
    return protect_crossings(graph,AllCrossings())

def join_ramp_ends(network,locals_,freeways,mosaic):
    """Only freeway ENDS may meet a local road. Nearby interior road crossings stay separate."""
    targets=list(locals_)
    tree=cKDTree([p[:2] for p in targets])
    added=0
    for node in freeways:
        if freeways.degree[node]!=1:continue
        a=np.array(node[:2]);prev=next(iter(freeways[node]))
        head=a-np.array(prev[:2]);head=head/(np.linalg.norm(head) or 1)
        best=None
        for idx in tree.query_ball_point(a,13):
            target=targets[idx];b=np.array(target[:2]);vec=b-a;dist=np.linalg.norm(vec)
            # Projection of the last ramp segment should touch the local street.
            if dist>2.1 and head@vec/(dist or 1)<.77:continue
            pts=np.rint(np.linspace(a,b,math.ceil(dist)+1)).astype(int)
            ink=mosaic[pts[:,1],pts[:,0]]
            if np.any(ink&WATER) or np.mean((ink&(LOCAL|FREEWAY))!=0)<.68:continue
            if best is None or dist<best[0]:best=(dist,target)
        if best and best[0]>.01:
            network.add_edge(node,best[1]);added+=1
    return added

def join_reviewed(graph,reviewed):
    targets=list(graph)
    tree=cKDTree([p[:2] for p in targets]);added=0
    # Connect corresponding centerlines only with longitudinal agreement. This
    # cannot turn at a crossing whose two tangents are perpendicular.
    for p in reviewed:
        if any(reviewed.edges[p,q].get('reviewLayer')==FREEWAY for q in reviewed[p]):
            continue
        a=np.array(p[:2])
        along=[np.array(q[:2])-a for q in reviewed[p]]
        targets_here=tree.query_ball_point(a,3.2)
        hits=[]
        for idx in targets_here:
            node=targets[idx]
            if node[2]!=LOCAL:continue
            b=np.array(node[:2]);dist=np.linalg.norm(b-a)
            if dist<.001:continue
            incident=[np.array(q[:2])-b for q in graph[node]]
            if any(abs(v@w)/(np.linalg.norm(v)*np.linalg.norm(w) or 1)>.95 for v in along for w in incident):
                hits.append((dist,node))
        if hits:
            graph.add_edge(p,min(hits)[1]);added+=1
    graph.update(reviewed)
    return added

def join_checked_breaks(graph):
    # These particular intervals were inspected on the original source JPEGs.
    # They only repair the same street under a map symbol or adjoining ramp.
    spans=[
        (13088.0, 19206.0, 13104.0, 19214.0),  # parallel local-road edge interrupted by a cyan mapping mark
        (10380.0, 10796.0, 10370.0, 10820.0),  # two sides of the same road crossing a mapping annotation
        (13154.0, 19282.0, 13132.0, 19266.0),  # the same road across the Route 82 label
        (16188.0, 18130.0, 16158.0, 18122.0),  # uninterrupted visibly curved local branch
        (10338.0, 11718.0, 10364.0, 11676.0),  # Route 50 shield
        (15294.0, 17442.0, 15298.0, 17440.0),  # uninterrupted street at staff map annotation
        (13642.0, 14710.0, 13648.0, 14694.0),  # street passing under overlaid transit lines
        (15160.0, 17022.0, 15142.0, 17034.0),  # street interrupted by transit-line overlay
        (15566.0, 16396.0, 15542.0, 16400.0),  # continuous east-west street below overlaid route symbols
        (13530.0, 14846.0, 13530.0, 14872.0),  # single north-south road under a cyan marker
        (15080.0, 16906.0, 15058.0, 16914.0),  # continuous local street across transit overlay
        (12122.0, 17032.0, 12104.0, 17048.0),  # same diagonal road either side of overlaid lines
        (15472.0, 14626.0, 15442.0, 14590.0),  # Route 7 shield on a visibly continuous bridge deck
        (13540.0, 14218.0, 13544.0, 14162.0),  # Route 35 shield
        (14444.0, 19122.0, 14452.0, 19164.0),  # continuous road interrupted by lettering
        (16882.0, 18380.0, 16898.0, 18380.0),  # continuous motorway lane
        (11900.0, 19712.0, 11874.0, 19712.0),  # same signed road under question-mark icon
        (12960.0, 23176.0, 13004.0, 23148.0),  # US 1 shield on continuous Keys highway
        (12418.0, 19490.0, 12400.0, 19528.0),  # question-mark icon obscures the same southbound road
    ]
    locations=list(graph);tree=cKDTree([[ORIGIN_X+p[0]*2, ORIGIN_Y+p[1]*2] for p in locations])
    for ax,ay,bx,by in spans:
        distances,indices=tree.query([(ax,ay),(bx,by)])
        if max(distances)>2:continue
        start,end=[locations[i] for i in indices]
        count=max(1,math.ceil(math.dist(start[:2],end[:2])*2/21))
        last=start
        for step in range(1,count+1):
            frac=step/count
            node=end if step==count else (start[0]+(end[0]-start[0])*frac,start[1]+(end[1]-start[1])*frac,'checked')
            graph.add_edge(last,node);last=node

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('tiles',type=Path);ap.add_argument('catalog',type=Path);ap.add_argument('output',type=Path)
    ap.add_argument('--cache',type=Path,help='Optional preclassified local development raster')
    a=ap.parse_args()
    if a.cache and a.cache.exists():
        mosaic=np.load(a.cache)
    else:
        mosaic=source_palette(a.tiles)
        if a.cache:np.save(a.cache,mosaic)
    # Confirmed apron/runway footprints at VCIA and the southwestern airfield.
    # Keep motor access roads outside them, including the VCIA terminal loop.
    blocked=Image.new('1',(STRIDE,SIZE[0]));draw=ImageDraw.Draw(blocked)
    polygons=[
        [(12700,16462),(14180,16500),(14420,16550),(14475,16665),(14442,16865),(14132,16853),(13800,16842),(13590,17182),(14380,17660),(14345,17852),(14170,17820),(12640,17004)],
        [(8730,23390),(8750,23166),(9180,22626),(9190,22360),(9440,22318),(9550,22546),(9630,22532),(9740,22850),(9790,23480),(9450,23550),(9350,23190),(9140,23105),(8850,23490)],
    ]
    for corners in polygons:draw.polygon([((x-ORIGIN_X)/2,(y-ORIGIN_Y)/2) for x,y in corners],fill=1)
    mosaic[np.asarray(blocked)]=0
    layers=[];gaps=[]
    for bit in (LOCAL,FREEWAY):
        graph=traces(mosaic,bit);gaps.append(gap_links(graph,mosaic,bit))
        layers.append(simplified(graph,bit))
        print('layer',bit,'simplified',len(layers[-1]),'gaps',gaps[-1],flush=True)
        del graph
    streets,highways=layers
    split=validate_freeways(highways,None)
    network=nx.compose(streets,highways)
    ramps=join_ramp_ends(network,streets,highways,mosaic)
    reviewed=nx.Graph();add_reviewed(reviewed)
    # The dual carriageway has shields, lane dividers and parallel frontage roads.
    # Keep a single reviewed through-path with no transfers at its grade-separated
    # crossings. Its east end has a fixed at-grade connection on the beach.
    freeway_trace=[p[:2] for p in reviewed if any(reviewed.edges[p,q].get('reviewLayer')==FREEWAY for q in reviewed[p])]
    near=cKDTree(freeway_trace)
    superseded=[n for n in network if n[2]==FREEWAY and near.query(n[:2])[0]<18]
    network.remove_nodes_from(superseded)
    attachments=join_reviewed(network,reviewed)
    join_checked_breaks(network)
    for comp in list(nx.connected_components(network)):
        if len(comp)<16:network.remove_nodes_from(comp)
    comps=sorted(nx.connected_components(network),key=len,reverse=True)
    idx={p:i for i,p in enumerate(p for comp in comps for p in sorted(comp,key=lambda n:(n[0],n[1],str(n[2:]))))}
    nodes=[[round((ORIGIN_X+2*p[0]-3550)/19,4),round((ORIGIN_Y+2*p[1]-5450)/19,4)] for p in idx]
    edges=[[idx[p],idx[q],round(2*math.dist(p[:2],q[:2]),2),0] for p,q in network.edges if math.dist(p[:2],q[:2])>.005]
    source=f'https://github.com/rolux/gtadb.org/tree/{TILES_REVISION}/maps'
    asset={'nodes':nodes,'edges':edges,'metersPerUnit':19,'source':source,'sourceMap':source,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','credit':'YANIS v16 · GTADB 及社区制图者，路网由原始瓦片提取','method':'按原图中的街道和高速公路两种颜色分别提取中心线，根据道路端点与路面连接匝道。人工复核市中心及跨湾通道。','limits':'社区估算，部分路段中断。单行方向、转向限制、立交层级和车辆通行性未经游戏验证。','componentSizes':[len(c) for c in comps],'straightThroughCrossings':split,'reviewedCorridors':['Downtown / Bayside','Venetian Causeway','I-395 / MacArthur Causeway','Vice Beach'],'registeredExtent':[3550,5450,22550,24450],'sourceTileRevision':TILES_REVISION,'archiveRevision':ARCHIVE_REVISION}
    a.output.write_text('// YANIS v16 / GTADB and contributors · CC BY 4.0. Color-separated road centerlines extracted and generalized from the pinned source JPEG tiles.\nwindow.roadNetwork='+json.dumps(asset,ensure_ascii=False,separators=(',',':'))+';\n')
    print('nodes/edges',len(nodes),len(edges),'components',len(comps),'largest',list(map(len,comps[:10])),'ramps',ramps,'review links',attachments,'separated',split)
if __name__=='__main__':main()
