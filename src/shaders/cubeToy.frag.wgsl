struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) worldPos: vec3f,
    @location(2) scale: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    if ((fragData.rawPos.x >= 0 && fragData.rawPos.y >= 0 && fragData.rawPos.z >= 0) ||
        (fragData.rawPos.x >= 0 && fragData.rawPos.y < 0  && fragData.rawPos.z < 0 ) ||
        (fragData.rawPos.x < 0  && fragData.rawPos.y < 0  && fragData.rawPos.z >= 0) ||
        (fragData.rawPos.x < 0  && fragData.rawPos.y >= 0 && fragData.rawPos.z < 0 )) {
        return vec4f(1.0, 1.0, 1.0, 1.0);
    }
    else {
        return vec4f(1, 0, 0, 1);
    }
}