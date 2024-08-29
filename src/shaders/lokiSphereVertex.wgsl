struct VertexOutput {
    @location(0) barycentric: vec3f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var barycentrics = array<vec3f, 3> (
        vec3(1, 0, 0),
        vec3(0, 1, 0),
        vec3(0, 0, 1)
    );
    var output: VertexOutput;
    var mvp = projection * view * model;
    output.position = mvp * vec4f(pos, 1);
    output.barycentric = barycentrics[vertexIndex % 3];
    return output;
}