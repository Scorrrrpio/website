struct VertexOutput {
    @location(0) rawPos: vec3f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var mvp = projection * view * model;
    output.position = mvp * vec4f(pos, 1);
    var scale = vec3f(
        length(vec3f(model[0].x, model[1].x, model[2].x)),
        length(vec3f(model[0].y, model[1].y, model[2].y)),
        length(vec3f(model[0].z, model[1].z, model[2].z)),
    );
    output.rawPos = pos;  // TODO remove for spheres
    return output;
}