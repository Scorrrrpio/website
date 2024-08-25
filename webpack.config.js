const path = require("path");
const htmlWebpackPlugin = require("html-webpack-plugin");
const copyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
	entry: {
		projects: "./src/js/projects.js",
		playground: "./src/js/playground.js",
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
		new HtmlWebpackPlugin({
			template: "./src/playground.html",
			filename: "playground.html",
			chunks: ["playground"]
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
				{ from: "src/shaders", to: "shaders" },
			],
		}),
	],
	mode: "development"  // or production
};
