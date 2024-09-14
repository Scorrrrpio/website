const path = require("path");
const htmlWebpackPlugin = require("html-webpack-plugin");
const copyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
	entry: {
		fpv: "./src/js/fpvEntry.js",
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
			chunks: ["fpv"]
		}),
		new copyWebpackPlugin({
			patterns: [
				{ from: "src/styles", to: "" },
				{ from: "src/geometry", to: "geometry" },
				{ from: "src/shaders", to: "shaders" },
				{ from: "src/media", to: "media" }
			],
		}),
	],
	mode: "development"  // or production
};
