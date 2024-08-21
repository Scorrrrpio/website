const path = require("path");
const htmlWebpackPlugin = require("html-webpack-plugin");
const copyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
	entry: {
		projects: "./src/js/projects.js",
		triangle: "./src/js/triangle.js",
		wip: "./src/js/wip.js"
	},
	output: {
		filename: "[name].bundle.js",
		path: path.resolve(__dirname, "public"),
		clean: true,
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
			template: "./src/wip.html",
			filename: "wip.html",
			chunks: ["wip"]
		}),
		new copyWebpackPlugin({
			patterns: [
				{ from: "src/styles", to: "" },
				{ from: "src/geometry", to: "geometry" },
			],
		}),
	],
	mode: "development"  // or production
};
