/*  This is a port to JavaScript of Rail's plugin functionality.  It uses the following
 * license:
 *  This is Free Software, copyright 2005 by Ryan Tomayko (rtomayko@gmail.com) 
     and is licensed MIT: (http://www.opensource.org/licenses/mit-license.php)
 */

steal(function( steal ) {
	// helpers ...
	var addHttps = function(url){
		return !/^https/.test(url) ? url.replace(/http/i, 'https') : url;
	},
	lastPart = function(url){
		return (url.substr(url.length-1) === "/" ? url.substr(0, url.length-1) : url).match(/[^\/]+$/)[0]
	};
	
	steal.get.github = function( url, where, options, level ) {
		if ( url ) {
			this.init.apply(this, arguments);
		}
	};
	
	steal.get.github.dependenciesUrl = function( url ) {
		url = addHttps(url);
		return steal.File(url).join("raw/master/dependencies.json");
	};
	// 
	steal.get.github.pluginDependenciesUrl = function(url){
		//http://github.com/jupiterjs/mxui/tree/master/util/selectable/ ->
		//https://github.com/jupiterjs/mxui/raw/master/util/selectable/selectable.js
		var pluginName = lastPart( url );
		if(url.indexOf('tree') == -1){
			return null;
		}
		return steal.File(addHttps(url)).join(pluginName + ".js").replace("/tree/","/raw/");
	}
	steal.get.github.prototype = new steal.get.getter();
	steal.extend(steal.get.github.prototype, {
		init: function( url, where, options, level ) {
			// not the best way of doing this, but ok for now.
			arguments[0] = url = url.replace("http:","https:");
			steal.get.getter.prototype.init.apply(this, arguments);
			this.orig_cwd = this.cwd;
			
			this.ignore.push(".gitignore", "dist");

			var split = url.split("/");
			this.username = split[3];
			this.project = split[4];
			this.branch = options.tag || "master";
			
			//we probably gave something like : http://github.com/secondstory/secondstoryjs-router instead
			// of http://github.com/secondstory/secondstoryjs-router/tree/master/
			if(! url.match(/\/tree\//) ){
				this.url = this.url+"tree/master/"
			}
			
		},
		get_latest_commit: function() {
			// http://github.com/api/v2/json/commits/list/jupiterjs/steal/master
			// https://github.com/api/v2/json/commits/list/jupiterjs/steal/master
			var latestCommitUrl = "https://github.com/api/v2/json/commits/list/" + this.username + "/" + this.project + "/" + this.branch,
				commitsText = readUrl(latestCommitUrl);
				eval("var c = " + commitsText),
				commitId = c.commits[0].tree;
			return commitId;
		},
		ls_top: function( link ) {
			var id = this.get_latest_commit(),
				browseUrl = "http://github.com/api/v2/json/tree/show/" + this.username + "/" + this.project + "/" + id,
				browseText = readUrl(browseUrl);
				eval("var tree = " + browseText);
			var urls = [],
				item;
			for ( var i = 0; i < tree.tree.length; i++ ) {
				item = tree.tree[i];
				if ( item.type == "blob" ) {
					urls.push(this.url + item.name);
				}
				else if ( item.type == "tree" ) {
					urls.push(this.url + item.name + '/');
				}
			}
			return urls;
		},
		//returns a bunch of links to folders
		links: function( base_url, contents ) {
			var links = [],
				newLink, 
				anchors = contents.match(/href\s*=\s*\"*[^\">]*/ig),
				ignore = this.ignore,
				self = this,
				base = this.url + this.cwd.replace(this.orig_cwd + "/", "");
			
			anchors.forEach(function( link ) {
				link = link.replace(/href="/i, "");
				newLink = base_url + (/\/$/.test(base_url) ? "" : "/") + link;
				links.push(newLink);
			});
			return links;
		},
		download: function( link ) {
			// get real download link
			// https://github.com/jupiterjs/srchr/tree/master/srchr/disabler/disabler.html  -->
			// https://github.com/jupiterjs/srchr/raw/master/srchr/disabler/disabler.html
			var rawUrl = link.replace("/tree/","/raw/"),
				bn = new steal.File(link).basename(),
				f = new steal.File(this.cwd).join(bn);

			for ( var i = 0; i < this.ignore.length; i++ ) {
				if ( f.match(this.ignore[i]) ) {
					steal.print("   I " + f);
					return;
				}
			}

			var oldsrc = readFile(f),
				tmp = new steal.File("tmps"),
				newsrc = readFile("tmps"),
				p = "   ",
				pstar = "   ";
			try{
				tmp.download_from(rawUrl, true);
			}catch(e){
				tmp.remove();
				steal.print(pstar+"Error "+f+"\n"+e);
				return;
			}
			
			
			
				if ( oldsrc ) {
					var trim = /\s+$/gm,
						jar = /\.jar$/.test(f);


						if ((!jar && oldsrc.replace(trim, '') == newsrc.replace(trim, '')) || (jar && oldsrc == newsrc)) {
							tmp.remove();
							return;
						}
						steal.print(pstar + "U " + f);
					tmp.copyTo(f);
				} else {
					steal.print(pstar + "A " + f);
					tmp.copyTo(f);
				}
				tmp.remove();
		},
		fetch_dir: function( url ) {

			this.level++;
			if ( this.level > 0 ) {
				this.push_d(new steal.File(url).basename());
			}
			// the root of a git repo has different rules about getting its contents:
			// what about a url like: https://github.com/jupiterjs/mxui/tree/master/data/grid2/tree/views
			if ( url.search(/\/tree\/\w+\/$/) == url.indexOf("/tree/") && url.indexOf("/tree/") > -1 ) { //if the root of the repo
				this.fetch(this.ls_top());
			} else {
				// change to the raw url
				// http://github.com/jupiterjs/jquerymx/
				// http://github.com/jupiterjs/jquerymx/tree/master/controller?raw=true
				var rawUrl, 
					contents;

				if(url.match(/\/tree\/\w/)){
					rawUrl  = url+"?raw=true"
				}else{
					rawUrl = this.url + "tree/" + this.branch + "/" + url.replace(this.url, "") + "?raw=true"
				}
		
				contents = readUrl(rawUrl);
				
				this.fetch(this.links(url, contents));
			}
			if ( this.level > 0 ) {
				this.pop_d();
			}
			this.level--;
		}
	});

});