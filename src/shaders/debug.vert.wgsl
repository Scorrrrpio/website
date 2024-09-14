struct VertexOutput {
    @location(0) normal: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @builtin(position) position: vec4<f32>
};

@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    var mvp = projection * view * model;
    output.normal = normal;
    output.uv = vec2<f32>(uv.x, uv.y);
    output.position = mvp * vec4<f32>(pos, 1);
    return output;
}