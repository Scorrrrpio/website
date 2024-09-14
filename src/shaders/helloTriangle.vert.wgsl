struct vertexOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f
};

@vertex
fn vertexMain(@location(0) pos: vec2f, @location(1) color: vec4f) -> vertexOut {
    var output: vertexOut;
    output.position = vec4f(pos, 0, 1);
    output.color = color;
    return output;
}