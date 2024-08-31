struct vertexOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f
};

@fragment
fn fragmentMain(fragData: vertexOut) -> @location(0) vec4f {
    return fragData.color;
}