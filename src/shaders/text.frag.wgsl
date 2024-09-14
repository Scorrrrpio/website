struct vOut {
    @location(0) uv: vec2f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var texture: texture_2d<f32>;
@group(0) @binding(1) var mySampler: sampler;

@fragment
fn fragmentMain(fragData: vOut) -> @location(0) vec4f {
    return textureSample(texture, mySampler, fragData.uv);
}