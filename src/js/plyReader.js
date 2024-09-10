import { AssetLoadError } from "./errors";

function readPlyHeader(lines) {
    if (lines[0] != "ply") throw new AssetLoadError("Invalid ply file");

    const typeAlias = {
        float: "float32",
        double: "float64",
        char: "int8",
        short: "int16",
        int: "int32",
        uchar: "uint8",
        ushort: "uint16",
        uint: "uint32",
    }
    function normalizeType(name) {
        return typeAlias[name] || name;
    }

    const metadata = {};
    metadata.elements = [];

    let dataStart = 0;
    let element = -1;
    for (const line of lines) {
        dataStart++;
        if (line === "end_header") {
            metadata.dataStart = dataStart;
            return metadata;
        }
        const parts = line.split(" ");
        if (parts[0] === "format") {
            metadata.format = parts[1];
            metadata.formatVersion = parts[2];
        }
        else if (parts[0] === "element") {
            metadata.elements.push({
                name: parts[1],
                count: Number(parts[2]),
                properties: [],
            });
            element++;
        }
        else if (parts[0] === "property") {
            if (parts[1] === "list") {
                metadata.elements[element].properties.push({
                    type: parts[1],
                    countType: normalizeType(parts[2]),
                    listType: normalizeType(parts[3]),
                    name: parts[4],
                    maxSize: 0,
                });
            }
            else {
                metadata.elements[element].properties.push({
                    name: parts[2],
                    type: normalizeType(parts[1]),
                });
            }
        }
    }
    throw new AssetLoadError("Invalid ply header: missing end_header");
}

function readASCII(lines, metadata) {
    const data = {};

    let startLine = metadata.dataStart;
    for (const element of metadata.elements) {
        data[element.name] = {};
        for (const property of element.properties) {
            data[element.name][property.name] = [];
        }

        for (let i = 0; i < element.count; i++) {
            const parts = lines[startLine+i].split(" ").map(Number);
            let readIndex = 0;
            for (const property of element.properties) {
                if (property.type === "list") {
                    if (parts[readIndex] > property.maxSize) {
                        property.maxSize = parts[readIndex];
                    }
                    data[element.name][property.name].push(
                        parts.slice(readIndex, readIndex + parts[readIndex] + 1).map(Number)
                    );
                    readIndex += parts[readIndex] + 1;
                }
                else {
                    data[element.name][property.name].push(parts[readIndex++]);
                }
            }
        }
        startLine += element.count
    }
    return data;
}

function parseProperty(type, view, offset, littleEndian) {
    const readers = {
        float32: view.getFloat32.bind(view),
        float64: view.getFloat64.bind(view),
        int8: view.getInt8.bind(view),
        int16: view.getInt16.bind(view),
        int32: view.getInt32.bind(view),
        uint8: view.getUint8.bind(view),
        uint16: view.getUint16.bind(view),
        uint32: view.getUint32.bind(view),
    }
    return Number(readers[type]?.(offset, littleEndian));
}

function readBinary(buffer, metadata) {
    const littleEndian = metadata.format === "binary_little_endian";
    const view = new DataView(buffer);
    const data = {};

    const advance = {
        float32: 4, float64: 8,
        int8: 1, int16: 2, int32: 4,
        uint8: 1, uint16: 2, uint32: 4,
    };

    let offset = 0;
    for (const element of metadata.elements) {
        data[element.name] = {};
        for (const property of element.properties) {
            data[element.name][property.name] = [];
        }
        
        for (let i = 0; i < element.count; i++) {
            for (const property of element.properties) {
                if (property.type === "list") {
                    const list = []
                    const count = parseProperty(property.countType, view, offset, littleEndian);
                    offset += advance[property.countType];
                    list.push(count);
                    if (count > property.maxSize) {
                        property.maxSize = count;
                    }
                    for (let j = 0; j < count; j++) {
                        list.push(parseProperty(property.listType, view, offset, littleEndian));
                        offset += advance[property.listType];
                    }
                    data[element.name][property.name].push(list)
                }
                else {
                    data[element.name][property.name].push(parseProperty(property.type, view, offset, littleEndian));
                    offset += advance[property.type];
                }
            }
        }
    }

    return data;
}

async function readPly(url) {
    // fetch ply file from server;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);

    // separate into lines
    const lines = text.split("\n");

    // read header
    const metadata = readPlyHeader(lines);

    // read data
    let data;
    if (metadata.format === "ascii") { data = readASCII(lines, metadata); }
    else if (metadata.format === "binary_little_endian" || metadata.format === "binary_big_endian") {
        const binaryStart = text.indexOf("end_header") + "end_header\n".length;
        data = readBinary(buffer.slice(binaryStart), metadata);
    }
    else { throw new AssetLoadError("Invalid ply format"); }

    return { data, metadata };
}

function createTypedArrays(element, count) {
    const typeCounts = {
        float32: [], float64: [],
        int8: [], int16: [], int32: [],
        uint8: [], uint16: [], uint32: [],
    }
    for (const property of element.properties) {
        if (property.type === "list") {
            typeCounts[property.countType].push(property.name + "_count");
            for (let i = 0; i < property.maxSize; i++) {
                typeCounts[property.listType].push(property.name);
            }
        }
        else {
            typeCounts[property.type].push(property.name);
        }
    }
    for (const type in typeCounts) {
        if (typeCounts[type].length > 0) {
            const values = {};
            switch (type) {
                case ("float32"): values.data = new Float32Array(count * typeCounts[type].length); break;
                case ("float64"): values.data = new Float64Array(count * typeCounts[type].length); break;
                case ("int8"):    values.data = new Int8Array(count * typeCounts[type].length);    break;
                case ("int16"):   values.data = new Int16Array(count * typeCounts[type].length);   break;
                case ("int32"):   values.data = new Int32Array(count * typeCounts[type].length);   break;
                case ("uint8"):   values.data = new Uint8Array(count * typeCounts[type].length);   break;
                case ("uint16"):  values.data = new Uint16Array(count * typeCounts[type].length);  break;
                case ("uint32"):  values.data = new Uint32Array(count * typeCounts[type].length);  break;
            }
            values.properties = typeCounts[type];
            element.values[type] = values;
        }
    }
}

export async function plyToTriangleList(url) {
    const { data, metadata } = await readPly(url);

    const plyData = {};
    plyData.url = url;

    for (const element of metadata.elements) {
        const indices = {
            float32: 0, float64: 0,
            int8: 0, int16: 0, int32: 0,
            uint8: 0, uint16: 0, uint32: 0,
        }

        const elem = {};
        elem.properties = element.properties;
        elem.values = {};

        if (element.name === "vertex") {
            // Generate TypedArrays
            const instances = data.face.vertex_indices.reduce((sum, a) => sum + (a[0] - 2) * 3, 0);
            createTypedArrays(elem, instances);

            if (data.face && data.face.vertex_indices) {
                for (const face of data.face.vertex_indices) {  // faces of mesh
                    for (let i = 2; i < face.length - 1; i++) {  // triangles of face
                        const triVerts = [face[1], face[i], face[i+1]];
                        for (const vert of triVerts) {  // vertices of triangle
                            for (const property of element.properties) {  // property of vertex
                                const t = property.type;
                                if (t === "list") {
                                    const ct = property.countType;
                                    const count = data[element.name][property.name][vert][0];
                                    elem.values[ct].data[indices[ct]++] = count;
                                    const lt = property.listType;
                                    for (let j = 0; j < property.maxSize; j++) {  // element of list
                                        if (j < count) {
                                            elem.values[lt].data[indices[lt]++] = data[element.name][property.name][vert][j+1];
                                        }
                                        else {
                                            // fill to maxSize with 0s
                                            elem.values[lt].data[indices[lt]++] = 0;
                                        }
                                    }
                                }
                                else {
                                    elem.values[t].data[indices[t]++] = data[element.name][property.name][vert];
                                }
                            }
                        }
                    }
                }
            }
            else { throw new AssetLoadError("Failed to generate geometry for ", url, ". Missing required element (face) or required property (vertex_indices)."); }
        }
        else {
            // Generate TypedArrays
            const instances = element.count
            createTypedArrays(elem, instances);

            for (let i = 0; i < instances; i++) {
                for (const property of element.properties) {
                    const t = property.type;
                    if (t === "list") {
                        const ct = property.countType;
                        const count = data[element.name][property.name][i][0];
                        elem.values[ct].data[indices[ct]++] = count;
                        const lt = property.listType;
                        for (let j = 0; j < property.maxSize; j++) {
                            if (j < count) {
                                elem.values[lt].data[indices[lt]++] = data[element.name][property.name][i][j+1];
                            }
                            else {
                                // fill to maxSize with 0s
                                elem.values[lt].data[indices[lt]++] = 0;
                            }
                        }
                    }
                    else {
                        elem.values[t].data[indices[t]++] = data[element.name][property.name][i];
                    }
                }
            }
        }

        plyData[element.name] = elem;
    }

    return plyData;
}