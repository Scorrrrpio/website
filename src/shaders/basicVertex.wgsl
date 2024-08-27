@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    var mvp = projection * view * model;
    return mvp * vec4f(pos, 1);
}