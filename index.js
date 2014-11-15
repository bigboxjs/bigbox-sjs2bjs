/**
 * Created by jiehua.yang on 2014/8/27.
 */

var FS = require("fs");
var PathUtil = require("path");

exports.translate = function(options) {
	return new Translater(options);
};

var Translater = function(options) {
	/*
	 {
		// 源路径
	 	from: "",
	 	// 目标路径
	 	to: "",
	 	// 跟目录
	 	root: "",

		// 排除路径
	 	excludes: [
	 		""
	 	]
	 }
	 */
	this._options = options;

	this.search(options.from);
};

/**
 * 搜索该文件下的所有文件
 * @param dir
 */
Translater.prototype.search = function(dir) {
	var options = this._options;
	var paths = FS.readdirSync(dir);
	paths.forEach((function(path) {
		switch (PathUtil.extname(path).toLowerCase()) {
			case "":
				// 这是文件夹

				// 获得绝对路径
				var abPath = PathUtil.join(dir, path, "/");

				// 获得这个路径相对于跟路径的相对路径
				var relaPath = PathUtil.relative(options.from, abPath + "/");

				// 如果是在排除的行列，则不做处理
				if (!this.needTranslate(abPath, relaPath)) return;

				// 如果目标路径下不存在这个文件夹，那就创建之
				var toDir = PathUtil.join(options.to, relaPath);
				if (!FS.existsSync(toDir)) {
					FS.mkdirSync(toDir);
				}

				this.search(abPath);
				break;
			case ".js":
				// 这是文件

				// 获得绝对路径
				var abPath = PathUtil.join(dir, path);

				// 获得这个路径相对于跟路径的相对路径
				var relaPath = PathUtil.relative(options.from, abPath);

				// 如果是在排除的行列，则不做处理
				if (!this.needTranslate(abPath, relaPath)) return;

				this.translate(abPath, PathUtil.join(options.to, relaPath), dir);
				break;
		}
	}).bind(this));
};

/**
 * 把指定路径的文件转化为json
 * @param srcPath
 */
Translater.prototype.translate = function(srcPath, toPath, dir) {
	// 读取文件内容
	var code = FS.readFileSync(srcPath).toString();

	// 如果发现某一行是写依赖$require，那就删除之
	var index = code.indexOf("var $require =");
	if (index != -1) {
		var lineIndex = code.indexOf(";", index);
		code = code.substr(0, index) + code.substr(lineIndex + 1);
	}

	// 替换所有的$require.async为require.async
	code = code.replace(/\$require\.async/mg, "require.async");

	// 生成浏览器端JS内容
	var browserCode = "define(function(require, exports, module) {" +
			'var __dirname = "' + PathUtil.relative(this._options.root, dir).replace(new RegExp("\\\\","g"), "/") + '";' +
			code +
		"});";

	// 写入到新文件中
	FS.writeFileSync(toPath, browserCode, {
			flag: "w"
	});
};

/**
 * 判断指定的文件是否需要转化
 * @param path
 * @param relativePath
 * @returns {boolean}
 */
Translater.prototype.needTranslate = function(path, relativePath) {
	var options = this._options;

	// 判断是否直接存在于排除列表中
	if (options.excludes.indexOf(relativePath) != -1) return false;

	// 如果还没有正则列表，那就建立之
	var excludeRegs = options._excludeRegs;
	if (!options._excludeRegs) {
		excludeRegs = options._excludeRegs = [];

		options.excludes.forEach(function(reg) {
			if (reg.charAt(0) == "^" || reg.charAt(reg.length - 1) == "$") {
				// 这才是正则
				excludeRegs.push(new RegExp(reg));
			}
		});
	}

	// 判断是否匹配排除正则
	for (var i = excludeRegs.length - 1; i > -1; i--) {
		if (excludeRegs[i].test(relativePath)) return false;
	}

	return true;
};