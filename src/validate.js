/** Validate bundle identity and references before installing a new graph. */
export function validateBundle(bundle) {
  if(!bundle || bundle.format!=='casadi_viz' || bundle.version!==1) {
    throw new Error('Expected a casadi_viz bundle (version 1)');
  }
  if(!Array.isArray(bundle.functions))throw Error('Expected a functions array');
  const graphs=[bundle,...bundle.functions];
  for(const graph of graphs) {
    for(const key of ['nodes','edges','inputs','outputs']) {
      if(!Array.isArray(graph[key]))throw Error('Missing graph array: '+key);
    }
    graph.nodes.forEach((node,id)=>{
      if(node.id!==id)throw Error('Instruction IDs must be consecutive');
      if(node.callee!==undefined && (!Number.isInteger(node.callee) || !graphs[node.callee])) {
        throw Error('Invalid callee reference');
      }
      for(const key of ['inputs','outputs','input_names','output_names','constants']) {
        if(!Array.isArray(node[key]))throw Error('Missing instruction array: '+key);
      }
    });
    for(const edge of graph.edges) {
      if(!Number.isInteger(edge.from) || !Number.isInteger(edge.to) ||
         !graph.nodes[edge.from] || !graph.nodes[edge.to] ||
         !Number.isInteger(edge.input) || !Number.isInteger(edge.output) ||
         edge.input<0 || edge.input>=graph.nodes[edge.to].inputs.length ||
         edge.output<0 || edge.output>=graph.nodes[edge.from].outputs.length) {
        throw Error('Invalid dependency edge');
      }
    }
  }
  return bundle;
}
