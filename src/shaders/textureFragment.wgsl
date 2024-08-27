struct VertexOutput {
    @location(0) uv: vec2f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    return vec4f(fragData.uv, 0, 1);
}