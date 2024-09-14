struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) barycentric: vec3f,
    @location(2) worldPos: vec3f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var barycentrics = array<vec3f, 3> (
        vec3f(1, 0, 0),
        vec3f(0, 1, 0),
        vec3f(0, 0, 1)
    );
    var output: VertexOutput;
    var mvp = projection * view * model;
    output.position = mvp * vec4f(pos, 1);
    output.barycentric = barycentrics[vertexIndex % 3];
    output.rawPos = pos;
    var worldSpace  =model * vec4f(pos, 1);
    output.worldPos = worldSpace.xyz;
    return output;
}