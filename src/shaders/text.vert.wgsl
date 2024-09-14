struct vOut {
    @location(0) uv: vec2f,
    @builtin(position) position: vec4f
};

@vertex
fn vertexMain(@location(0) pos: vec2f, @location(1) uv: vec2f) -> vOut {
    var output: vOut;
    output.position = vec4f(pos, 0, 1);
    output.uv = uv;
    return output;
}