"use strict";

function app_start() {
	TemplateJS.View.lightbox_class = "lightbox";
	window.app = new App();
	window.app.init();
	
}

function fetch_error(e) {
	if (!fetch_error.shown) {
		fetch_error.shown = true;
		var txt;
		if (e.headers) {
			var ct = e.headers.get("Content-Type");
			if (ct == "text/html" || ct == "application/xhtml+xml") {
				txt = e.text().then(function(text) {
				 	var parser = new DOMParser();
					var htmlDocument = parser.parseFromString(text, ct);
					var el = htmlDocument.body.querySelector("p");
					if (!el) el = body;
					return el.innerText;
				});
			} else {
				txt = e.text();
			}
		} else {
			txt = Promise.resolve(e.toString());
		}
		txt.then(function(t) {
			app.dlgbox({text:e.status+" "+e.statusText, desc:t},"network_error").then(function() {
				fetch_error.shown = false;
			});
		});
	}
	throw e;	
}

function fetch_with_error(url, opt) {
	return fetch_json(url, opt).catch(fetch_error);
}

function App() {	
	this.traders={};
	this.config={};
	this.curForm = null;
}

TemplateJS.View.prototype.showWithAnim = function(item, state) {	
	var elem = this.findElements(item)[0];
	var h = elem.classList.contains("hidden") || elem.hidden;
	if (state) {
		if (h) {
			elem.hidden = false;
			TemplateJS.waitForDOMUpdate().then(function(x) {
				elem.classList.remove("hidden");
			});
		}
	} else {
		if (!h) {
			elem.classList.add("hidden");
			var anim = new TemplateJS.Animation(elem);
			anim.wait().then(function(x) {
				if (elem.classList.contains("hidden")) 
					elem.hidden = true;
			});
		}
	}
}

App.prototype.createTraderForm = function() {
	var form = TemplateJS.View.fromTemplate("trader_form");
	var norm=form.findElements("goal_norm")[0];
	var pl = form.findElements("goal_pl")[0];
	form.dlgRules = function() {
		var state = this.readData(["goal","advanced"]);
		this.showWithAnim("goal_norm",state.goal == "norm");
		this.showWithAnim("goal_pl",state.goal == "pl");
		form.getRoot().classList.toggle("no_adv", !state["advanced"]);
		
	};
	form.setItemEvent("goal","change", form.dlgRules.bind(form));
	form.setItemEvent("advanced","change", form.dlgRules.bind(form));
	return form;
}

App.prototype.createTraderList = function(form) {
	if (!form) form = TemplateJS.View.fromTemplate("trader_list");
	var items = Object.keys(this.traders).map(function(x) {
		return {
			image:this.brokerImgURL(this.traders[x].broker),
			caption: this.traders[x].title,
			broker: this.traders[x].broker,
			id: this.traders[x].id,			
		};
	},this);
	items.sort(function(a,b) {
		return a.broker.localeCompare(b.broker);
	});
	items.unshift({
		"image":"../res/options.png",
		"caption":"Options",				
		"id":"$"
		
	})
	items.unshift({
		"image":"../res/security.png",
		"caption":"Users and security",				
		"id":"!"
		
	})
	items.push({
		"image":"../res/add_icon.png",
		"caption":"",				
		"id":"+"
	});
	items.forEach(function(x) {
		x[""] = {"!click":function(id) {
			form.select(id);
		}.bind(null,x.id)}
	});
	form.setData({"item": items});
	form.select = function(id) {
		var update = items.map(function(x) {
			return {"":{"classList":{"selected": x.id == id}}};
		});
		form.setData({"item": update});
		
		var nf;
		if (id == "!") {
			if (this.curForm) {
				this.curForm.save();				
				this.curForm = null;
			}
			nf = this.securityForm();
			this.desktop.setItemValue("content", nf);
			nf.save = function() {};

		} else if (id == '$') {
			if (this.curForm) {
				this.curForm.save();				
				this.curForm = null;
			}
			nf = this.optionsForm();
			this.desktop.setItemValue("content", nf);
			this.curForm = nf;
			
		} else if (id == "+") {
			this.brokerSelect().then(this.pairSelect.bind(this)).then(function(res) {
				var broker = res[0];
				var pair = res[1];
				var name = res[2];				
				if (!this.traders[name]) this.traders[name] = {};
				var t = this.traders[name];
				t.broker = broker;
				t.pair_symbol = pair;
				t.id = name;
				if (!t.title) t.title = pair;
				this.updateTopMenu(name);
			}.bind(this))
		} else {
			if (this.curForm) {
				this.curForm.save();				
				this.curForm = null;
			}

			nf = this.openTraderForm(id);			

			this.desktop.setItemValue("content", TemplateJS.View.fromTemplate("main_form_wait"));
			
			nf.then(function (nf) {
				this.desktop.setItemValue("content", nf);
				this.curForm = nf;
				this.curForm.save = function() {
					this.traders[id] = this.saveForm(nf, this.traders[id]);
					this.updateTopMenu();
				}.bind(this);
				this.curTrader = this.traders[id];
			}.bind(this));
		}
	}.bind(this);
	
	return form;
}

App.prototype.processConfig = function(x) {	
	this.config = x;
	this.users = x["users"] || [];
	this.traders = x["traders"] || {}
	for (var id in this.traders) this.traders[id].id = id;
	return x;	
}

App.prototype.loadConfig = function() {
	return fetch_with_error("api/config").then(this.processConfig.bind(this));
}

App.prototype.brokerURL = function(broker) {
	return "api/brokers/"+encodeURIComponent(broker);
}
App.prototype.pairURL = function(broker, pair) {
	return this.brokerURL(broker) + "/pairs/" + encodeURIComponent(pair);	
}
App.prototype.brokerImgURL = function(broker) {
	return this.brokerURL(broker) + "/icon.png";	
}
App.prototype.traderURL = function(trader) {
	return "api/traders/"+encodeURIComponent(trader);
}

function defval(v,w) {
	if (v === undefined) return w;
	else return v;
}


function powerToEA(power, pair) {
		var total; 
		if (pair.leverage) {
			total = pair.currency_balance / pair.price;
			return power * total;
		} else {
			total = pair.currency_balance / pair.price + pair.asset_balance;
			return power * total;
		}
}


function calc_range(a, ea, c, p) {
	a = a+ea;
	var value = a * p;
	var max_price = pow2((a * Math.sqrt(p))/ea);
	var S = value - c
	var min_price = S<=0?0:pow2(S/(a*Math.sqrt(p)));
	if (!isFinite(max_price)) max_price = "∞";
	return {
		range_min_price: adjNum(min_price),
		range_max_price: adjNum(max_price)
	}

	
}

App.prototype.fillForm = function (src, trg) {
	var data = {};	
	var broker = fetch_with_error(this.brokerURL(src.broker));
	var pair = fetch_with_error(this.pairURL(src.broker, src.pair_symbol));
	var orders = fetch_json(this.pairURL(src.broker, src.pair_symbol)+"/orders");
	data.id = src.id;
	data.title = src.title;
	data.symbol = src.pair_symbol;
	data.broker = broker.then(function(x) {return x.exchangeName;});
	data.no_api_key = broker.then(function(x) {return {".hidden": x.trading_enabled};});
	data.broker_id = broker.then(function(x) {return x.name;});
	data.broker_ver = broker.then(function(x) {return x.version;});
	data.asset = pair.then(function(x) {return x.asset_symbol;})
	data.currency = pair.then(function(x) {return x.currency_symbol;})
	data.balance_asset= pair.then(function(x) {return adjNum(invSize(x.asset_balance,x.invert_price));})
	data.balance_currency = pair.then(function(x) {return adjNum(x.currency_balance);})
	data.price= pair.then(function(x) {return adjNum(invPrice(x.price,x.invert_price));})
	data.leverage=pair.then(function(x) {return x.leverage?x.leverage+"x":"n/a";});
	data.broker_img = this.brokerImgURL(src.broker);
	data.advanced = src.advenced;
	
	data.goal = pair.then(function(x) {
		var pl = x.leverage || src.force_margin || src.neutral_pos;
		var dissw = !!x.leverage;
		return {
			"value":pl?"pl":"norm",
			".disabled": dissw 
		};
	})
	data.enabled = src.enabled;
	data.dry_run = src.dry_run;
	data.external_assets = {
			value:defval(src.external_assets,0),
			"!input": updateRange
	}
	data.acum_factor =defval(src.acum_factor,0);
	data.accept_loss = data.accept_loss_pl = defval(src.accept_loss,0);
	data.power = src.power;
	var neutral_pos = src.neutral_pos?src.neutral_pos.split(" "):[];
	data.neutral_pos_type = neutral_pos.length == 1?"assets":neutral_pos[0];
	data.neutral_pos_val = src.neutral_pos?(neutral_pos.length == 1?neutral_pos[0]:neutral_pos[1]):0;
	data.max_pos = defval(src.max_pos,0);
	data.sliding_pos_hours = defval(src["sliding_pos.hours"],240);
	data.sliding_pos_weaken = defval(src["sliding_pos.weaken"],11);
	data.spread_calc_hours = defval(src.spread_calc_hours,5*24);
	data.spread_calc_min_trades = defval(src.spread_calc_min_trades,4);
	data.dynmult_raise = defval(src.dynmult_raise,250);
	data.dynmult_fall = defval(src.dynmult_fall, 0.5);
	data.dynmult_mode = src.dynmult_mode || "half_alternate";
	data.order_mult = defval(src.buy_mult,1)*100;
	data.min_size = defval(src.min_size,0);
	data.internal_balance = src.internal_balance;
	data.dust_orders = defval(src.dust_orders,true);
	data.detect_manual_trades = src.detect_manual_trades;
	data.report_position_offset = defval(src.report_position_offset,0);
	data.init_backtest = {"!click":this.init_backtest.bind(this,trg,src.id, pair)};
	data.force_spread = adjNum((Math.exp(defval(src.force_spread,0))-1)*100);
	data.expected_trend=defval(src.expected_trend,0);
	data.open_orders_sect = orders.then(function(x) {return {".hidden":!x.length};},function() {return{".hidden":true};});	
	data.orders = Promise.all([orders,pair]).then(function(x) {
		var orders = x[0];
		var pair = x[1];
		var mp = orders.map(function(z) {
			return {
				id: z.id,
				dir: invSize(z.size,pair.invert_price)>0?"BUY":"SELL",
				price:adjNum(invPrice(z.price, pair.invert_price)),
				size: adjNum(Math.abs(z.size))
			};});
		if (mp.length) {
			var butt = document.createElement("button");
			butt.innerText="X";
			mp[0].action = {
					"rowspan":mp.length,
					"value": butt
			};
			butt.addEventListener("click", this.cancelAllOrders.bind(this, src.id));
		}
		return mp;
	}.bind(this),function(){});

	function updateEA() {	
		var d = trg.readData(["power","goal","advanced"]);
		if (d.goal == "pl") {
			pair.then(function(p) {
				d.external_assets = adjNum(powerToEA(d.power, p));
				d.external_volume = adjNum(d.external_assets * p.price);
				trg.setData(d);
				updateRange();
			});
		} else if (!d.advanced) {
			d.external_assets = 0;
			trg.setData(d);
			updateRange();
		}
	}
	
	function updateRange() {
		pair.then(function(p) {
			var d = trg.readData(["external_assets"]);
			var r = calc_range(p.asset_balance, parseFloat(d.external_assets), p.currency_balance, p.price);
			trg.setData(r);
		});
		
	}
	data.power ={"!change": updateEA};		
	
	Promise.all([pair,data.goal]).then(function(pp) {
		var p = pp[0];
		var goal = pp[1].value;
		var data = {};
		var l = p.leverage || 1;
		if (!src.power) {
			if (src.external_assets) {
				var part = powerToEA(1,p);
				data.power = src.external_assets/part; 
			} else if (goal == "pl") {
				data.power = 20;
				data.neutral_pos_val = 0;
				data.neutral_pos_type = "assets";
			} else if (goal == "norm") {
				data.power = 1;
				data.neutral_pos_val = 1;
				data.neutral_pos_type = "center";
			}
		}
		trg.setData(data);
		trg.p = p;
		updateEA();
	})	
	
	data.icon_repair={"!click": this.repairTrader.bind(this, src.id)};
	data.icon_reset={"!click": this.resetTrader.bind(this, src.id)};
	data.icon_delete={"!click": this.deleteTrader.bind(this, src.id)};
	data.icon_undo={"!click": this.undoTrader.bind(this, src.id)};
	
	return trg.setData(data).then(trg.dlgRules.bind(trg));
}


App.prototype.saveForm = function(form, src) {

	var data = form.readData();
	var trader = {}
	var goal = data.goal;
	trader.id = src.id;
	trader.broker =src.broker;
	trader.pair_symbol = src.pair_symbol;
	trader.title = data.title;
	trader.enabled = data.enabled;
	trader.dry_run = data.dry_run;
	trader.advenced = data.advanced;
	trader.accept_loss = data.accept_loss;
	if (goal == "norm") {
		trader.acum_factor = data.acum_factor;
		trader.force_margin=false;
	} else {
		trader.neutral_pos = data.neutral_pos_type+" "+data.neutral_pos_val;
		trader.max_pos = data.max_pos;
		trader["sliding_pos.hours"] = data.sliding_pos_hours;
		trader["sliding_pos.weaken"] = data.sliding_pos_weaken;
		trader.force_margin=true;
	}
	trader.external_assets = data.external_assets;
	trader.spread_calc_hours =data.spread_calc_hours;
	trader.spread_calc_min_trades = data.spread_calc_min_trades;
	trader.dynmult_raise = data.dynmult_raise;
	trader.dynmult_fall = data.dynmult_fall;
	trader.dynmult_mode = data.dynmult_mode;
	trader.buy_mult = data.order_mult/100;
	trader.sell_mult = data.order_mult/100;
	trader.min_size = data.min_size;
	trader.internal_balance = data.internal_balance;
	trader.dust_orders = data.dust_orders;
	trader.detect_manual_trades = data.detect_manual_trades;
	trader.report_position_offset = data.report_position_offset;
	trader.force_spread = Math.log(data.force_spread/100+1);	
	trader.expected_trend = data.expected_trend;
	return trader;
	
}

App.prototype.openTraderForm = function(trader) {
	var form = this.createTraderForm();
	var p = this.fillForm(this.traders[trader], form);	
	return p.then(function() {return form;});
}

TemplateJS.View.regCustomElement("X-SLIDER", new TemplateJS.CustomElement(
		function(elem,val) {
			var range = elem.querySelector("input[type=range]");
			var number = elem.querySelector("input[type=number]");
			var mult = parseFloat(elem.dataset.mult);
			var fixed = parseInt(elem.dataset.fixed)
			var toFixed = function(v) {
				if (!isNaN(fixed)) return parseFloat(v).toFixed(fixed);
				else return v;
			}
			if (!range) {
				range = document.createElement("input");
				range.setAttribute("type","range");
				number = document.createElement("input");
				number.setAttribute("type","number");
				var env1 = document.createElement("div");
				var env2 = document.createElement("div");
				var min = parseFloat(elem.dataset.min);
				var max = parseFloat(elem.dataset.max);
				var rmin = Math.floor(min/mult);
				var rmax = Math.floor(max/mult);
				range.setAttribute("min",rmin);
				range.setAttribute("max",rmax);
				range.addEventListener("input",function() {
					var v = parseInt(this.value);
					var val = v * mult;
					number.value = toFixed(val);
					elem.dispatchEvent(new Event("change"));
				});
				number.addEventListener("change", function() {
					var v = parseFloat(this.value);
					var val = v / mult;
					range.value = val;
					elem.dispatchEvent(new Event("change"));
				});				
				env1.appendChild(range);
				env2.appendChild(number);
				elem.appendChild(env1);
				elem.appendChild(env2);
			}
			range.value = val / mult;
			number.value = toFixed(val);

			
		},
		function(elem) {
			var number = elem.querySelector("input[type=number]");
			if (number) return parseFloat(number.value);
			else return 0;
			
		},
		function(elem,attrs) {
			
		}
));

App.prototype.init = function() {
	this.strtable = document.getElementById("strtable").dataset;
	this.desktop = TemplateJS.View.createPageRoot(true);
	this.desktop.loadTemplate("desktop");
	var top_panel = TemplateJS.View.fromTemplate("top_panel");
	this.top_panel = top_panel;
	this.desktop.setItemValue("top_panel", top_panel);
	
	top_panel.setItemEvent("save","click", this.save.bind(this));
	
	return this.loadConfig().then(function() {
		var menu = this.createTraderList();
		this.menu =  menu;
		this.desktop.setItemValue("menu", menu);
		
		top_panel.setItemEvent("save", this.save.bind(this));
		
	}.bind(this));
	
}

App.prototype.brokerSelect = function() {
	var _this = this;
	return new Promise(function(ok, cancel) {
		
		var form = TemplateJS.View.fromTemplate("broker_select");
		form.openModal();
		fetch_with_error("api/brokers").then(function(x) {
			var excl_info = [];
			var lst = x["entries"].map(function(itm) {
				var z = fetch_with_error(_this.brokerURL(itm))
					.then(function(z) {
						return {
								".hidden":z.trading_enabled
								};
					});
				excl_info.push(z);
				return {
					excl_info: z,
					image:_this.brokerImgURL(itm),
					caption: itm,
					"":{
						"!click": function() {
							form.close();
							ok(itm);
						}
					}
				};
			});
			excl_info = Promise.all(excl_info)
				.then(function(lst) {
					return {
						".hidden": lst.reduce(function(a,b) {
						return a && b[".hidden"];
						},true)};				
				});
			form.setData({
				"item":lst,
				"excl_info": excl_info
			});
		});
		form.setCancelAction(function() {
			form.close();
			cancel();
		},"cancel");
	
	});
}

App.prototype.pairSelect = function(broker) {
	var _this = this;
	return new Promise(function(ok, cancel) {
		var form = TemplateJS.View.fromTemplate("broker_pair");
		form.openModal();
		form.setCancelAction(function() {
			form.close();
			cancel();
		},"cancel");
		form.setDefaultAction(function() {
			form.close();
			var d = form.readData();
			if (!d.pair || !d.name) return;
			var name = d.name.replace(/[^-a-zA-Z0-9_.~]/g,"_");
			ok([broker, d.pair, name]);
		},"ok");
		fetch_with_error(_this.pairURL(broker,"")).then(function(data) {
			var pairs = [{"":{"value":"----",".value":""}}].concat(data["entries"].map(function(x) {
				return {"":{"value":x,".value":x}};
			}));			
			form.setItemValue("item",pairs);
			form.showItem("spinner",false);
			dlgRules();
		},function() {form.close();cancel();});
		form.setItemValue("image", _this.brokerImgURL(broker));
		var last_gen_name="";
		function dlgRules() {
			var d = form.readData(["pair","name"]);
			if (d.name == last_gen_name) {
				d.name = last_gen_name = broker+"_"+d.pair;
				form.setItemValue("name", last_gen_name);
			}
			form.enableItem("ok", d.pair != "" && d.name != "");			
		};
		
		
		form.setItemEvent("pair","change",dlgRules);
		form.setItemEvent("name","change",dlgRules);
		dlgRules();
	});
	
}

App.prototype.updateTopMenu = function(select) {
	this.createTraderList(this.menu);
	if (select) this.menu.select(select);
}

App.prototype.waitScreen = function(promise) {	
	var d = TemplateJS.View.fromTemplate('waitdlg');
	d.openModal();
	return promise.then(function(x) {
		d.close();return x;
	}, function(e) {
		d.close();throw e;
	});
}

App.prototype.cancelAllOrdersNoDlg = function(id) { 	

		var tr = this.traders[id];
		var cr = fetch_with_error(
			this.pairURL(tr.broker, tr.pair_symbol)+"/orders",
			{method:"DELETE"});
		var dr = fetch_json(
			this.traderURL(tr.id)+"/stop",
			{method:"POST"}).catch(function() {});


		return this.waitScreen(Promise.all([cr,dr]))
			.catch(function(){})
			.then(function() {
				return fetch_with_error(this.pairURL(tr.broker, tr.pair_symbol), {cache: 'reload'});
			}.bind(this));

													
}

App.prototype.deleteTrader = function(id) {
	return this.dlgbox({"text":this.strtable.askdelete},"confirm").then(function(){
			this.curForm.close();
			delete this.traders[id];
			this.updateTopMenu();
			this.curForm = null;
	}.bind(this));
}

App.prototype.undoTrader = function(id) {
	this.curForm.close();
	this.curForm = null;
	this.updateTopMenu(id);
}

App.prototype.resetTrader = function(id) {
	this.dlgbox({"text":this.strtable.askreset,
		"ok":this.strtable.yes,
		"cancel":this.strtable.no},"confirm").then(function(){

		var tr = this.traders[id];
		this.waitScreen(fetch_with_error(
			this.traderURL(tr.id)+"/reset",
			{method:"POST"})).then(function() {				
						this.updateTopMenu(tr.id);				
			}.bind(this));
	}.bind(this));
}

App.prototype.repairTrader = function(id) {
		this.dlgbox({"text":this.strtable.askrepair,
		"ok":this.strtable.yes,
		"cancel":this.strtable.no},"confirm").then(function(){

		var tr = this.traders[id];
		this.waitScreen(fetch_with_error(
			this.traderURL(tr.id)+"/repair",
			{method:"POST"})).then(function() {
						this.updateTopMenu(tr.id);				
			}.bind(this));
	}.bind(this));
}

App.prototype.cancelAllOrders = function(id) {
	return this.dlgbox({"text":this.strtable.askcancel,
		"ok":this.strtable.yes,
		"cancel":this.strtable.no},"confirm").then(this.cancelAllOrdersNoDlg.bind(this,id))
			.then(function() {
						this.updateTopMenu(id);
					}.bind(this));

}

App.prototype.addUser = function() {
	return new Promise(function(ok,cancel) {
		var dlg = TemplateJS.View.fromTemplate("add_user_dlg");
		dlg.openModal();
		dlg.setCancelAction(function(){
			dlg.close();
			cancel();
		},"cancel");
		dlg.setDefaultAction(function(){
			dlg.close();
			var data = dlg.readData();
			var dlg2 = TemplateJS.View.fromTemplate("password_dlg");
			dlg2.openModal();
			dlg2.setData(data);
			dlg2.setCancelAction(function() {
				dlg2.close();
				cancel();
			},"cancel");
			dlg2.setDefaultAction(function() {
				dlg2.unmark();
				var data2 = dlg2.readData();
				if (data2.pwd == "" ) return
				if (data2.pwd2 == "" ) {
					dlg2.findElements("pwd2")[0].focus();
					return;
				}
				if (data2.pwd  != data2.pwd2) {
					dlg2.mark("errpwd");
				} else {
					ok({
						username:data.username,
						password:data2.pwd,
						comment:data.comment
					});
					dlg2.close();
				}				
			},"ok");
		},"ok");
	});
}


App.prototype.securityForm = function() {
	var form = TemplateJS.View.fromTemplate("security_form");
	
	function dropUser(user, text){		
		this.dlgbox({"text": text+user}, "confirm").then(function() {
			this.users = this.users.filter(function(z) {
				return z.username != user;
			});
			update.call(this);
		}.bind(this));
	}
	
	
	function update() {
		
		var rows = this.users.map(function(x) {
			var that = this;
			return {
				user:x.username,
				role:{
					"value":x.admin?"admin":"viewer",
					"!change": function() {
						x.admin = this.value == "admin"
					}
				},
				comment:x.comment,
				drop:{"!click":function() {
					dropUser.call(that, x.username, this.dataset.question);
				}}
			}
		},this)
		
		var data = {
			rows:rows,
			add:{
				"!click":function() {
					
					this.addUser().then(function(u) {
						var itm = this.users.find(function(z) {
							return z.username == u.username;
						});
						if (itm) itm.password = u.password;
						else this.users.push(u);
						update.call(this);
					}.bind(this));					
				}.bind(this)
				
			},
			"logout":{"!click": this.logout.bind(this)},
			guest_role:{
				"!change":function() {
					this.config.guest = form.readData(["guest_role"]).guest_role == "viewer";
				}.bind(this),
				"value": !this.config.guest?"none":"viewer"
			}
		};
		
		form.setData(data);
		
	}
	update.call(this);
	
	return form;
}

App.prototype.dlgbox = function(data, template) {
	return new Promise(function(ok, cancel) {
		var dlg = TemplateJS.View.fromTemplate(template);
		dlg.openModal();
		dlg.setData(data);
		dlg.setCancelAction(function() {
			dlg.close();cancel();
		},"cancel");
		dlg.setDefaultAction(function() {
			dlg.close();ok();
		},"ok");
	});		
}

App.prototype.save = function() {
	if (this.curForm) {
		this.curForm.save();
	}
	var top = this.top_panel;
	top.showItem("saveprogress",true);
	top.showItem("saveok",false);
	this.config.users = this.users;
	this.config.traders = this.traders;
	this.validate(this.config).then(function(config) {
		fetch_json("api/config",{
			method: "PUT",
			headers: {
				"Content-Type":"application/json",
			},
			body:JSON.stringify(config)
		}).then(function(x) {
			top.showItem("saveprogress",false);
			top.showItem("saveok",true);
			this.processConfig(x);
			this.updateTopMenu
		}.bind(this),function(e){
			top.showItem("saveprogress",false);
			fetch_error(e);
		});
	}.bind(this), function(e) {
		top.showItem("saveprogress",false);
		if (e.trader)   
			this.menu.select(e.trader);		
		this.dlgbox({text:e.message},"validation_error");
	}.bind(this));
}

App.prototype.logout = function() {
	var d = TemplateJS.View.fromTemplate("waitdlg");
	d.openModal();
	var f = document.createElement("iframe");
	f.src = "api/logout";
	document.body.appendChild(f);
	setTimeout(function() {		
		location.href = "../index.html";
	},2000);
}

App.prototype.validate = function(cfg) {
	return new Promise(function(ok, error) {
		var admin = cfg.users.find(function(x) {
			return x.admin;
		})
		if (!admin) return error({
				"trader":"!",
				"message":this.strtable.need_admin
			});	
		ok(cfg); 
	}.bind(this));
}




App.prototype.init_backtest = function(form, id, pair) {
	var url = this.traderURL(id)+"/trades";
	var el = form.findElements("backtest_anchor")[0];
	var bt = TemplateJS.View.fromTemplate("backtest_res");
	el.parentNode.insertBefore(bt.getRoot(),el.nextSibling);
	form.enableItem("init_backtest",false);		
	bt.getRoot().scrollIntoView(false);
	Promise.all([fetch_with_error(url),pair]).then(function(v) {
		var trades=v[0];
		var pair = v[1];
		if (trades.length == 0) {
			bt.close();
			this.dlgbox({text:this.strtable.backtest_nodata,cancel:{hidden:"hidden"}},"confirm");
			return;
		}
		if (trades.length < 100) {
			this.dlgbox({text:this.strtable.backtest_lesstrades,cancel:{hidden:"hidden"}},"confirm");
		}
		
		var elems = ["external_assets","power", 
			"sliding_pos_hours", "sliding_pos_weaken",
			"order_mult","min_size","dust_orders","expected_trend","goal"];

		var interval = trades[trades.length-1].time - trades[0].time;
		var drawChart = initChart(interval,5,700000);
		var chart1 = bt.findElements('chart1')[0];
		var chart2 = bt.findElements('chart2')[0];
		//var chart3 = bt.findElements('chart3')[0];
		
		var tm;
				
		
		function recalc() {
			if (tm) clearTimeout(tm);
			tm = setTimeout(function() {
				var data = form.readData(elems);

				var min_size = parseFloat(data.min_size);
				if (pair.min_size > data.min_size) min_size = pair.min_size;
				if (data.dust_orders == false) min_size = 0;

				var h =  parseFloat(data.sliding_pos_hours);
				var w =  parseFloat(data.sliding_pos_weaken);
				var g = data.goal;
				if (g == "norm") {
					w = 0;
					h = 0;
				}
				var et =  parseFloat(data.expected_trend)*0.01;
				if (pair.invert_price) {
					et = -et;
				}

				
				var res = calculateBacktest(trades, 
						parseFloat(data.external_assets),
						h,
						w,
						parseFloat(data.order_mult)*0.01,
						min_size,false,et
						);

				if (pair.invert_price) {
					res.chart.forEach(function(x){
						x.price = 1/x.price;
						x.np = 1/x.np;
						x.achg = -x.achg;
					});
				}
			
				bt.setData({
					bt_pl: adjNum(res.pl),
					bt_pln: adjNum(res.pln),
					bt_dd: adjNum(res.mdd),
					bt_mp: adjNum(res.maxpos),
				})

				drawChart(chart1,res.chart,"pl",[],"pln");
				drawChart(chart2,res.chart,"price",[],"np");
		//		drawChart(chart3,res.chart,"achg",[]);
			}, 1);
		}
		
		recalc();
		elems.forEach(function(x) {
			var el = form.findElements(x)[0];
			el.addEventListener("input", recalc);
		});		
		
	}.bind(this),function() {
			bt.close();
	});
}

App.prototype.optionsForm = function() {
	var form = TemplateJS.View.fromTemplate("options_form");
	var data = {
			report_interval: defval(this.config.report_interval,864000000)/86400000
	};
	form.setData(data);
	form.save = function() {
		var data = form.readData();
		this.config.report_interval = data.report_interval*86400000;
	}.bind(this);
	return form;
	
}
