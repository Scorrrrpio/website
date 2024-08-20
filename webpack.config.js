const path = require("path");
const htmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
	entry: {
		projects: "./src/js/projects.js",
		triangle: "./src/js/triangle.js",
		wip: "./src/js/wip.js"
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
			chunks: ["triangle"]
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
		}),
		new htmlWebpackPlugin({
			template: "./src/wip.html",
			filename: "wip.html",
			chunks: ["wip"]
		})
	],
	mode: "development"  // or production
};
