struct VertexOutput {
    @location(0) normal: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @builtin(position) position: vec4<f32>
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    return vec4<f32>(fragData.uv, 0, 1);
}