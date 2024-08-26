@fragment
fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    return vec4f(0, 1, 0, 1);
}