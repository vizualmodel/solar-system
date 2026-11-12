export const modelDescriptor = {
  version: 1, id: 'vizualmodel/solar-system', label: 'Solar System', build: __MODEL_BUILD__,
  tools: [
    { name: 'read_state', description: 'Read actual current browser model time, supported dates, playback, view IDs and display options. Use before a control.', operation: 'read', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'set_time', description: 'Set an absolute UTC time within current FROM/TO. Preserve playback and all unrelated state. Read back after an unknown outcome.', operation: 'control', inputSchema: { type: 'object', properties: {time:{type:'string',maxLength:30},expectedRevision:{type:'integer',minimum:0}}, required:['time'], additionalProperties:false } },
    { name: 'set_view_options', description: 'Set absolute labels and/or orbit visibility in an explicit existing view. Preserve other options and other views.', operation: 'control', inputSchema: { type:'object', properties:{viewId:{type:'string',maxLength:100},labels:{type:'boolean'},orbits:{type:'boolean'},expectedRevision:{type:'integer',minimum:0}},required:['viewId'],additionalProperties:false } },
    { name: 'investigate_earth_mars', description: 'Use the existing Earth–Mars closest-approach calculation in a browser worker. Read-only. after and optional until must be UTC timestamps inside current FROM/TO. Return actual time, distance in AU, provenance and assumptions.', operation:'read',inputSchema:{type:'object',properties:{after:{type:'string',maxLength:30},until:{type:'string',maxLength:30}},required:['after'],additionalProperties:false} },
  ],
};
