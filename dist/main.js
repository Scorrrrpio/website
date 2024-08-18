/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/helloTriangle.js":
/*!******************************!*\
  !*** ./src/helloTriangle.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   helloTriangle: () => (/* binding */ helloTriangle)\n/* harmony export */ });\n/* harmony import */ var _lerp__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lerp */ \"./src/lerp.js\");\n/* harmony import */ var _noWGPU__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./noWGPU */ \"./src/noWGPU.js\");\n// imports\n\n\n\n\nasync function helloTriangle() {\n\t// BOILERPLATE AND SETUP\n\t// locate canvas\n\tconst canvas = document.querySelector(\"canvas\");\n\n\t// check for browser WebGPU compatibility\n\tif (!navigator.gpu) {\n\t\t(0,_noWGPU__WEBPACK_IMPORTED_MODULE_1__.noWGPU)(canvas);\n\t\tthrow new Error(\"WebGPU is not supported in this browser\");\n\t}\n\n\t// request GPUAdapter\n\tconst adapter = await navigator.gpu.requestAdapter();\n\tif (!adapter) {\n\t\t(0,_noWGPU__WEBPACK_IMPORTED_MODULE_1__.noWGPU)(canvas);\n\t\tthrow new Error(\"No appropriate GPUAdapter found\");\n\t}\n\n\t// request device\n\tconst device = await adapter.requestDevice();\n\n\t// configure canvas\n\tconst context = canvas.getContext(\"webgpu\");\n\tconst format = navigator.gpu.getPreferredCanvasFormat();\n\tcontext.configure({\n\t\tdevice: device,\n\t\tformat: format\n\t});\n\n\n\t// GEOMETRY\n\tconst vertices = new Float32Array([\n\t\t// X,  Y,    R    G    B    A\n\t\t0.0,  1.0,  1.0, 0.0, 0.0, 1.0,\n\t\t1.0, -0.73, 0.0, 1.0, 0.0, 1.0,\n\t\t-1.0, -0.73, 0.0, 0.0, 1.0, 1.0\n\t]);\n\n\t// arrays for lerping\n\tconst triangleRBG = new Float32Array([\n\t\t// X,  Y,    R    G    B    A\n\t\t0.0,  1.0,  1.0, 0.0, 0.0, 1.0,\n\t\t1.0, -0.73, 0.0, 1.0, 0.0, 1.0,\n\t\t-1.0, -0.73, 0.0, 0.0, 1.0, 1.0\n\t]);\n\n\tconst triangleGRB = new Float32Array([\n\t\t// X,  Y,    R    G    B    A\n\t\t0.0,  1.0,  0.0, 0.0, 1.0, 1.0,\n\t\t1.0, -0.73, 1.0, 0.0, 0.0, 1.0,\n\t\t-1.0, -0.73, 0.0, 1.0, 0.0, 1.0\n\t]);\n\n\tconst triangleBGR = new Float32Array([\n\t\t// X,  Y,    R    G    B    A\n\t\t0.0,  1.0,  0.0, 1.0, 0.0, 1.0,\n\t\t1.0, -0.73, 0.0, 0.0, 1.0, 1.0,\n\t\t-1.0, -0.73, 1.0, 0.0, 0.0, 1.0\n\t]);\n\n\t// create vertex buffer\n\tconst vertexBuffer = device.createBuffer({\n\t\tlabel: \"Triangle Vertices\",\n\t\tsize: vertices.byteLength,\n\t\tusage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST\n\t});\n\n\t// copy vertex data into vertex buffer\n\tdevice.queue.writeBuffer(vertexBuffer, 0, vertices);\n\n\t// define vertex layout\n\tconst vertexBufferLayout = {\n\t\tarrayStride: 4 * 6 /*bytes*/,\n\t\tattributes: [{\n\t\t\tformat: \"float32x2\",\n\t\t\toffset: 0,\n\t\t\tshaderLocation: 0\n\t\t}, {\n\t\t\tformat: \"float32x4\",\n\t\t\toffset: 4 * 2 /*bytes*/ ,\n\t\t\tshaderLocation: 1\n\t\t}]\n\t};\n\n\n\t// SHADERS\n\t// vertex shader\n\tconst vertexShaderCode = `\n\t\tstruct vertexOut {\n\t\t\t@builtin(position) position: vec4f,\n\t\t\t@location(0) color: vec4f\n\t\t};\n\n\t\t@vertex\n\t\tfn vertexMain(@location(0) pos: vec2f, @location(1) color: vec4f) -> vertexOut {\n\t\t\tvar output: vertexOut;\n\t\t\toutput.position = vec4f(pos, 0, 1);\n\t\t\toutput.color = color;\n\t\t\treturn output;\n\t\t}`;\n\n\t// fragment shader\n\tconst fragmentShaderCode = `\n\t\tstruct vertexOut {\n\t\t\t@builtin(position) position: vec4f,\n\t\t\t@location(0) color: vec4f\n\t\t};\n\n\t\t@fragment\n\t\tfn fragmentMain(fragData: vertexOut) -> @location(0) vec4f {\n\t\t\treturn fragData.color;\n\t\t}\n\t`;\n\n\t// create shader modules\n\tconst vertexShaderModule = device.createShaderModule({\n\t\tlabel: \"Triangle Vertex Shader\",\n\t\tcode: vertexShaderCode\n\t});\n\tconst fragmentShaderModule = device.createShaderModule({\n\t\tlabel: \"Triangle Fragment Shader\",\n\t\tcode: fragmentShaderCode\n\t});\n\n\n\t// PIPELINE\n\tconst pipeline = device.createRenderPipeline({\n\t\tlabel: \"Triangle Pipeline\",\n\t\tlayout: \"auto\",\n\t\tvertex: {\n\t\t\tmodule: vertexShaderModule,\n\t\t\tentryPoint: \"vertexMain\",\n\t\t\tbuffers: [{\n\t\t\t\tarrayStride: 4 * 6 /*bytes*/,\n\t\t\t\tattributes: [{\n\t\t\t\t\tformat: \"float32x2\",\n\t\t\t\t\toffset: 0,\n\t\t\t\t\tshaderLocation: 0\n\t\t\t\t}, {\n\t\t\t\t\tformat: \"float32x4\",\n\t\t\t\t\toffset: 4 * 2 /*bytes*/ ,\n\t\t\t\t\tshaderLocation: 1\n\t\t\t\t}]\n\t\t\t}]\n\t\t},\n\t\tfragment: {\n\t\t\tmodule: fragmentShaderModule,\n\t\t\tentryPoint: \"fragmentMain\",\n\t\t\ttargets: [{\n\t\t\t\tformat: format,\n\t\t\t}]\n\t\t},\n\t\tprimitive: {\n\t\t\ttopology: \"triangle-list\"\n\t\t}\n\t});\n\n\n\t// RENDER LOOP\n\tlet frames = 0;\n\tfunction renderLoop() {\n\t\t// lerp\n\t\tframes %= 300;\n\t\tif (frames < 100) {\n\t\t\t// RBG to BRG\n\t\t\t(0,_lerp__WEBPACK_IMPORTED_MODULE_0__.lerpVector)(vertices, triangleRBG, triangleBGR, frames / 100);  // normalize\n\t\t}\n\t\telse if (frames < 200) {\n\t\t\t// BGR to GBR\n\t\t\t(0,_lerp__WEBPACK_IMPORTED_MODULE_0__.lerpVector)(vertices, triangleBGR, triangleGRB, (frames-100) / 100);\n\t\t}\n\t\telse {\n\t\t\t// GBR to RGB\n\t\t\t(0,_lerp__WEBPACK_IMPORTED_MODULE_0__.lerpVector)(vertices, triangleGRB, triangleRBG, (frames-200) / 100);\n\t\t}\n\t\t// copy data to vertices buffer\n\t\tdevice.queue.writeBuffer(vertexBuffer, 0, vertices);\n\n\t\t// create GPUCommandEncoder\n\t\tconst encoder = device.createCommandEncoder();\n\n\t\t// begin render pass\n\t\tconst pass = encoder.beginRenderPass({\n\t\t\tcolorAttachments: [{\n\t\t\t\tview: context.getCurrentTexture().createView(),\n\t\t\t\tloadOp: \"clear\",\n\t\t\t\tclearValue: { r: 0, g: 0, b: 0, a: 1 },\n\t\t\t\tstoreOp: \"store\"\n\t\t\t}]\n\t\t});\n\n\t\t// render triangle\n\t\tpass.setPipeline(pipeline);\n\t\tpass.setVertexBuffer(0, vertexBuffer);\n\t\tpass.draw(vertices.length / 6);  // 3 vertices\n\n\t\t// end render pass\n\t\tpass.end();\n\n\t\t// create and submit GPUCommandBuffer\n\t\tdevice.queue.submit([encoder.finish()]);\n\n\t\tframes++;\n\t}\n\n\t// schedule renderLoop()\n\trenderLoop();\n\tconst UPDATE_INTERVAL = 100;  // 10 fps\n\tsetInterval(renderLoop, UPDATE_INTERVAL);\n}\n\n//# sourceURL=webpack://amkoz/./src/helloTriangle.js?");

/***/ }),

/***/ "./src/lerp.js":
/*!*********************!*\
  !*** ./src/lerp.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   lerpVector: () => (/* binding */ lerpVector)\n/* harmony export */ });\n// LERP FUNCTION\nfunction lerpVector(vOut, v1, v2, t) {\n    if (vOut.length != v1.length || vOut.length != v2.length) {\n        return;\n    }\n    for (let i = 0; i < v1.length; i++) {\n        vOut[i] = v1[i] * (1-t) + v2[i] * t;\n    }\n}\n\n//# sourceURL=webpack://amkoz/./src/lerp.js?");

/***/ }),

/***/ "./src/main.js":
/*!*********************!*\
  !*** ./src/main.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _helloTriangle__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./helloTriangle */ \"./src/helloTriangle.js\");\n\n\n(0,_helloTriangle__WEBPACK_IMPORTED_MODULE_0__.helloTriangle)().catch((error) => { console.log(error.message); });\n\n//# sourceURL=webpack://amkoz/./src/main.js?");

/***/ }),

/***/ "./src/noWGPU.js":
/*!***********************!*\
  !*** ./src/noWGPU.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   noWGPU: () => (/* binding */ noWGPU)\n/* harmony export */ });\n// NO GPU SUPPORT\nfunction noWGPU(hide) {\n    const dialogue = document.querySelector(\".no-webgpu\");\n    hide.style.display = \"none\";\n    dialogue.style.display = \"block\";\n}\n\n//# sourceURL=webpack://amkoz/./src/noWGPU.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main.js");
/******/ 	
/******/ })()
;