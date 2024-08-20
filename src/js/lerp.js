// LERP FUNCTION
export function lerpVector(vOut, v1, v2, t) {
    if (vOut.length != v1.length || vOut.length != v2.length) {
        return;
    }
    for (let i = 0; i < v1.length; i++) {
        vOut[i] = v1[i] * (1-t) + v2[i] * t;
    }
}