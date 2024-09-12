struct VertexOutput {
    @location(0) rawPos: vec3<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) scale: vec3<f32>,
    @location(3) uv: vec2<f32>,
    @location(4) normals: vec3<f32>,
    @builtin(position) position: vec4<f32>
};

@group(0) @binding(0) var<uniform> model: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

@vertex
fn vertexMain(@location(0) pos: vec3<f32>,
@location(1) normals: vec3<f32>,
@location(2) uv: vec2<f32>,
@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var mvp = projection * view * model;
    output.position = mvp * vec4<f32>(pos, 1);
    var worldSpace = model * vec4<f32>(pos, 1);
    output.worldPos = worldSpace.xyz;
    output.scale = vec3<f32>(
        length(vec3<f32>(model[0].x, model[1].x, model[2].x)),
        length(vec3<f32>(model[0].y, model[1].y, model[2].y)),
        length(vec3<f32>(model[0].z, model[1].z, model[2].z)),
    );
    output.rawPos = pos;
    output.uv = vec2<f32>(uv.x ,1-uv.y);
    return output;
}