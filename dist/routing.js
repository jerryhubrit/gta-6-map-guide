// Coordinates use the atlas's 0–1000 map space. All reported distances are meters.
window.AtlasRouting = (() => {
  const metersPerUnit = 19;
  const maxWalkMeters = 180;
  const cache = new WeakMap();

  function isPoint(point) {
    return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]);
  }

  function graphFor(network) {
    if (!network || !Array.isArray(network.nodes) || !Array.isArray(network.edges)) return null;
    if (cache.has(network)) return cache.get(network);
    const { nodes } = network;
    const adjacency = Array.from({ length: nodes.length }, () => []);
    const segments = [];
    const parent = Int32Array.from(nodes, (_, index) => index);
    function component(node) {
      while (parent[node] !== node) {
        parent[node] = parent[parent[node]];
        node = parent[node];
      }
      return node;
    }
    for (const edge of network.edges) {
      if (!Array.isArray(edge)) continue;
      const [from, to, length, direction] = edge;
      if (!Number.isInteger(from) || !Number.isInteger(to) || !isPoint(nodes[from]) || !isPoint(nodes[to])) continue;
      if (!Number.isFinite(length) || length <= 0) continue;
      const [x, y] = nodes[from];
      const dx = nodes[to][0] - x;
      const dy = nodes[to][1] - y;
      const squaredLength = dx * dx + dy * dy;
      if (!squaredLength) continue;
      parent[component(to)] = component(from);
      const forward = direction !== -1;
      const reverse = direction !== true && direction !== 1;
      if (forward) adjacency[from].push([to, length]);
      if (reverse) adjacency[to].push([from, length]);
      segments.push({ from, to, length, forward, reverse, x, y, dx, dy, squaredLength });
    }
    for (const edge of segments) edge.group = component(edge.from);
    const graph = { nodes, adjacency, segments };
    cache.set(network, graph);
    return graph;
  }

  function nearbyRoads(point, segments) {
    const closestByGroup = new Map();
    const limit = (maxWalkMeters / metersPerUnit) ** 2;
    for (const edge of segments) {
      const projection = ((point[0] - edge.x) * edge.dx + (point[1] - edge.y) * edge.dy) / edge.squaredLength;
      const t = Math.max(0, Math.min(1, projection));
      const x = edge.x + t * edge.dx;
      const y = edge.y + t * edge.dy;
      const gap = (point[0] - x) ** 2 + (point[1] - y) ** 2;
      if (gap > limit) continue;
      const existing = closestByGroup.get(edge.group);
      if (existing && existing.gap <= gap) continue;
      closestByGroup.set(edge.group, { edge, t, point: [x, y], gap, walk: Math.sqrt(gap) * metersPerUnit });
    }
    return [...closestByGroup.values()].sort((a, b) => a.walk - b.walk);
  }

  // Distances from the start projection, or to the destination projection.
  function endpoints({ edge, t }, leaving) {
    const choices = [];
    if (t === 0 || (leaving ? edge.reverse : edge.forward)) choices.push([edge.from, t * edge.length]);
    if (t === 1 || (leaving ? edge.forward : edge.reverse)) choices.push([edge.to, (1 - t) * edge.length]);
    return choices;
  }

  // Min-heap of [distance, node] pairs for Dijkstra's algorithm.
  function enqueue(heap, entry) {
    let i = heap.length;
    heap.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= entry[0]) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = entry;
  }

  function dequeue(heap) {
    const first = heap[0];
    const last = heap.pop();
    if (!heap.length) return first;
    let i = 0;
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
      if (heap[child][0] >= last[0]) break;
      heap[i] = heap[child];
      i = child;
    }
    heap[i] = last;
    return first;
  }

  function route(start, destination, network) {
    const graph = graphFor(network);
    if (!graph?.segments.length) return { ok: false, reason: 'no-roads' };
    if (!isPoint(start) || !isPoint(destination)) return { ok: false, reason: 'too-far' };
    const starts = nearbyRoads(start, graph.segments);
    const ends = nearbyRoads(destination, graph.segments);
    if (!starts.length || !ends.length) {
      return { ok: false, reason: 'too-far', missingStart: !starts.length, missingEnd: !ends.length };
    }
    if (starts[0].edge.group === ends[0].edge.group) return drive(graph, starts[0], ends[0]);
    // Only consider a nearby parallel approach when a marker is off the road.
    // A pin placed on the road itself stays there, including at bridges and ramps.
    const candidates = roads => roads.filter(r => r === roads[0] || (roads[0].walk > 8 && r.walk <= roads[0].walk + 35));
    const endByGroup = new Map(candidates(ends).map(r => [r.edge.group, r]));
    const pairs = candidates(starts).map(a => [a, endByGroup.get(a.edge.group)]).filter(pair => pair[1]);
    pairs.sort((p, q) => (p[0].walk + p[1].walk) - (q[0].walk + q[1].walk));
    for (const [a, b] of pairs) {
      const result = drive(graph, a, b);
      if (result.ok) return { ...result, alternativeApproach: true };
    }
    return { ok: false, reason: 'disconnected' };
  }

  function drive(graph, a, b) {

    let best = Infinity;
    let lastNode = -1;
    if (a.edge === b.edge) {
      const delta = b.t - a.t;
      if (delta === 0 || (delta > 0 ? a.edge.forward : a.edge.reverse)) best = Math.abs(delta) * a.edge.length;
    }

    const costs = new Float64Array(graph.nodes.length).fill(Infinity);
    const previous = new Int32Array(graph.nodes.length).fill(-1);
    const goals = new Map(endpoints(b, false));
    const queue = [];
    for (const [node, cost] of endpoints(a, true)) {
      costs[node] = cost;
      enqueue(queue, [cost, node]);
    }
    while (queue.length) {
      const [cost, node] = dequeue(queue);
      if (cost >= best) break;
      if (cost !== costs[node]) continue;
      const tail = goals.get(node);
      if (tail !== undefined && cost + tail < best) {
        best = cost + tail;
        lastNode = node;
      }
      for (const [next, length] of graph.adjacency[node]) {
        const candidate = cost + length;
        if (candidate >= best || candidate >= costs[next]) continue;
        costs[next] = candidate;
        previous[next] = node;
        enqueue(queue, [candidate, next]);
      }
    }
    if (!Number.isFinite(best)) return { ok: false, reason: 'disconnected' };
    // A missing junction in the reconstructed network can send nearby points
    // kilometers around the block. A genuine island or canyon detour can also
    // trip this heuristic; in that case we withhold guidance for the pair.
    const directMeters = Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) * metersPerUnit;
    if (best > 8 * directMeters && best - directMeters > 1500) {
      return { ok: false, reason: 'unreliable-detour' };
    }

    const path = [];
    for (let node = lastNode; node !== -1; node = previous[node]) path.push(graph.nodes[node]);
    path.reverse();
    path.unshift(a.point);
    path.push(b.point);
    const geometry = path.filter((p, i) => i === 0 || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1]);
    return { ok: true, path: geometry, group: a.edge.group, meters: best, startWalk: a.walk, endWalk: b.walk };
  }

  function coverage(network, start) {
    const graph = graphFor(network);
    if (!graph) return { segments: [], group: null };
    const closest = isPoint(start) ? nearbyRoads(start, graph.segments)[0] : null;
    return { segments: graph.segments, group: closest?.edge.group ?? null };
  }

  return { route, coverage };
})();
