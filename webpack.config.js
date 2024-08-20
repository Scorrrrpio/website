const path = require("path");
const htmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
	entry: {
		index: "./src/index.js",
		projects: "./src/projects.js",
		triangle: "./src/triangle.js"
	},
	output: {
		filename: "[name].bundle.js",
		path: path.resolve(__dirname, "public"),
		//clean: true
	},
	plugins: [
		new htmlWebpackPlugin({
			template: "./src/index.html",
			filename: "index.html",
			chunks: ["index"]
		}),
		new htmlWebpackPlugin({
			template: "./src/projects.html",
			filename: "projects.html",
			chunks: ["projects"]
		}),
		new htmlWebpackPlugin({
			template: "./src/info.html",
			filename: "info.html",
			chunks: []
		}),
		new htmlWebpackPlugin({
			template: "./src/triangle.html",
			filename: "triangle.html",
			chunks: ["triangle"]
		})
	],
	mode: "development"  // or production
};
