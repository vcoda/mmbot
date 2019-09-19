"use strict";

function app_start() {
	TemplateJS.View.lightbox_class = "lightbox";
	window.app = new App();
	window.app.init();
	
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

App.prototype.loadConfig = function() {
	return fetch_json("api/config").then(function(x) {
		this.config = x;
		this.users = x["users"] || [];
		this.traders = x["traders"] || {}
		for (var id in this.traders) this.traders[id].id = id;
		return x;
	}.bind(this))
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

function defval(v,w) {
	if (v === undefined) return w;
	else return v;
}

function valIdx(goal) {
	return goal == "norm"?0:1;
}

App.prototype.fillForm = function (src, trg) {
	var data = {};	
	var broker = fetch_json(this.brokerURL(src.broker));
	var pair = fetch_json(this.pairURL(src.broker, src.pair_symbol));
	data.id = src.id;
	data.title = src.title;
	data.symbol = src.pair_symbol;
	data.broker = broker.then(function(x) {return x.exchangeName;});
	data.no_api_key = broker.then(function(x) {return {".hidden": x.trading_enabled};});
	data.broker_id = broker.then(function(x) {return x.name;});
	data.broker_ver = broker.then(function(x) {return x.version;});
	data.asset = pair.then(function(x) {return x.asset_symbol;})
	data.currency = pair.then(function(x) {return x.currency_symbol;})
	data.balance_asset= pair.then(function(x) {return adjNum(x.asset_balance);})
	data.balance_currency = pair.then(function(x) {return adjNum(x.currency_balance);})
	data.price= pair.then(function(x) {return adjNum(x.price);})
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
	data.external_assets = defval(src.external_assets,0);
	data.acum_factor =defval(src.acum_factor,0);
	data.accept_loss = data.accept_loss_pl = defval(src.accept_loss,0);
	data.power = src.external_assets;
	var neutral_pos = src.neutral_pos?src.neutral_pos.split(" "):[];
	data.neutral_pos_type = neutral_pos.length == 1?"assets":neutral_pos[0];
	data.neutral_pos_val = src.neutral_pos?(neutral_pos.length == 1?neutral_pos[0]:neutral_pos[1]):0;
	data.max_pos = defval(src.max_pos,0);
	data.sliding_pos_hours = defval(src["sliding_pos.hours"],240);
	data.sliding_pos_weaken = defval(src["sliding_pos.weaken"],11);
	data.spread_calc_hours = defval(src.spread_calc_hours,5*24);
	data.spread_calc_min_trades = defval(src.spread_calc_min_trades,1);
	data.dynmult_raise = defval(src.dynmult_raise,250);
	data.dynmult_fall = defval(src.dynmult_fall, 0.5);
	data.dynmult_mode = src.dynmult_mode || "half_alternate";
	data.order_mult = defval(src.buy_mult,1);
	data.min_size = defval(src.min_size,0);
	data.internal_balance = src.internal_balance;
	data.dust_orders = src.internal_balance;
	data.detect_manual_trades = src.detect_manual_trades;
	data.report_position_offset = defval(src.report_position_offset,0);
	data.force_spread = adjNum((Math.exp(defval(src.force_spread,0))-1)*100);
	
	Promise.all([pair,data.goal]).then(function(pp) {
		var p = pp[0];
		var goal = pp[1].value;
		var data = {};
		var l = p.leverage || 1;
		if (!src.external_assets && goal == "pl") {
			data.power = adjNum(p.currency_balance/p.price*l/5);
			data.neutral_pos_val = 0;
			data.neutral_pos_type = "assets";
		} else if (goal == "norm") {
			data.power = adjNum((p.currency_balance/p.price + p.asset_balance)*5);
			data.neutral_pos_val = 1;
			data.neutral_pos_type = "center";
		}
		trg.setData(data);
	})	
	
	data.execute = {
		"!click": function() {
			var d = trg.readData(["oper"]);
			switch (d.oper) {
			case "delete":
				trg.close();
				this.deleteTrader(src.id);
				break;
			case "repair":
				this.repairTrader(src.id);
				break;
			case "reset":
				this.resetTrader(src.id);
				break;
			case "cancelAll":
				this.cancelAllOrders(src.id);
				break;
			break;
			}
		}.bind(this)
	};
	
	return trg.setData(data).then(trg.dlgRules.bind(trg));
}


App.prototype.saveForm = function(form, src) {
	var data = form.readData();
	var trader = {}
	var goal = data.goal;
	var gidx = valIdx(goal);
	trader.id = src.id;
	trader.broker =src.broker;
	trader.pair_symbol = src.pair_symbol;
	trader.title = data.title;
	trader.enabled = data.enabled;
	trader.dry_run = data.dry_run;
	trader.advenced = data.advanced;
	if (goal == "norm") {
		trader.external_assets = data.external_assets;
		trader.acum_factor = data.acum_factor;
		trader.accept_loss = data.accept_loss;		
	} else {
		trader.external_assets = data.power;
		trader.neutral_pos = data.neutral_pos_type+" "+data.neutral_pos_val;
		trader.max_pos = data.max_pos;
		trader.accept_loss = data.accept_loss_pl;		
		trader["sliding_pos.hours"] = data.sliding_pos_hours;
		trader["sliding_pos.weaken"] = data.sliding_pos_weaken;
	}
	trader.spread_calc_hours =data.spread_calc_hours;
	trader.spread_calc_min_trades = data.spread_calc_min_trades;
	trader.dynmult_raise = data.dynmult_raise;
	trader.dynmult_fall = data.dynmult_fall;
	trader.dynmult_mode = data.dynmult_mode;
	trader.buy_mult = data.order_mult;
	trader.sell_mult = data.order_mult;
	trader.min_size = data.min_size;
	trader.internal_balance = data.internal_balance;
	trader.dust_orders = data.dust_orders;
	trader.detect_manual_trades = data.detect_manual_trades;
	trader.report_position_offset = data.report_position_offset;
	trader.force_spread = Math.log(data.force_spread/100+1);	
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
				});
				number.addEventListener("change", function() {
					var v = parseFloat(this.value);
					var val = v / mult;
					range.value = val;
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
	this.desktop = TemplateJS.View.createPageRoot(true);
	this.desktop.loadTemplate("desktop");
	var top_panel = TemplateJS.View.fromTemplate("top_panel");
	this.desktop.setItemValue("top_panel", top_panel);
	
	top_panel.setItemEvent("save","click", function() {
		this.save();
	}.bind(this));
	
	return this.loadConfig().then(function() {
		var menu = this.createTraderList();
		this.menu =  menu;
		this.desktop.setItemValue("menu", menu);
	}.bind(this));
}

App.prototype.save = function() {
	
}

App.prototype.brokerSelect = function() {
	var _this = this;
	return new Promise(function(ok, cancel) {
		
		var form = TemplateJS.View.fromTemplate("broker_select");
		form.openModal();
		fetch_json("api/brokers").then(function(x) {
			var excl_info = [];
			var lst = x["entries"].map(function(itm) {
				var z = fetch_json(_this.brokerURL(itm))
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
						},false)};				
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
		fetch_json(_this.pairURL(broker,"")).then(function(data) {
			var pairs = [{"":{"value":"----",".value":""}}].concat(data["entries"].map(function(x) {
				return {"":{"value":x,".value":x}};
			}));			
			form.setItemValue("item",pairs);
			dlgRules();
		});
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

App.prototype.deleteTrader = function(id) {
	delete this.traders[id];
	this.updateTopMenu();
	this.curForm = null;
}

App.prototype.resetTrader = function(id) {
	alert("Reset Trader not implemented: "+id);
}

App.prototype.repairTrader = function(id) {
	alert("Repair Trader not implemented: "+id);
}

App.prototype.cancelAllOrders = function(id) {
	alert("CancelAllOrders not implemented: "+id);
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
			var data = dlg.readData();
			dlg.unmark();
			if (data.pwd  != data.pwd2) {
				dlg.mark("errpwd");
			} else {
				dlg.close();
				ok({
					username:data.username,
					password:data.pwd,
					comment:data.comment
				});
			}
			
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