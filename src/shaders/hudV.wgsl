@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
    return projection * vec4f(pos, -3, 1);
}