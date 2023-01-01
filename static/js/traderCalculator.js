$(function() {

	function toSelect(array) {
		return _.map(array, function(v) {
			return {
				value: v
			};
		});
	};

	function getSelectizeRender(value) {
		if (value == "account") {
			return {
				item: function(item, escape) {
					return "<div class='form__option'><i class='ac-ico ac-ico_xs ac-ico_" + escape(item.value) + "' ></i>&nbsp;" + "<span>"+ item.text + "</span></div>";
				},
				option: function(item, escape) {
					return "<div class='form__option'><i class='ac-ico ac-ico_xs ac-ico_" + escape(item.value) + "' ></i>&nbsp;" + "<span>"+ item.text + "</span></div>";
				}
			}
		}
		return {
			item: function(data, escape) {
				return '<div class="form__option">' + data[value] + '</div>';
			},
			option: function(data, escape) {
				return '<div class="form__option">' + data[value] + '</div>';
			}
		};
	};

	function promisesAll(array) {
		return $.when.apply($.when, array).then(function() {
			return _.map(arguments, function(v) {
				return v[0].result;
			});
		});
	};

	function getCurrency(cur1, cur2, type) {
		if(cur1 == 'EUC') cur1 = 'EUR';
		if(cur2 == 'EUC') cur2 = 'EUR';
		if(cur1 == 'USC') cur1 = 'USD';
		if(cur2 == 'USC') cur2 = 'USD';
		if (this.quotes[cur1 + cur2]) {
			return this.quotes[cur1 + cur2][type];
		} else if (this.quotes[cur2 + cur1]) {
			return 1 / this.quotes[cur2 + cur1][type];
		} else {
			if (cur1 == cur2) return 1;
		}
		// ищем матчинг по вхождению валюты в ключи this.quotes
		// напр. cur1 + cur2 = "EURRUB", а в this.quotes етсь только "EURRUB!"
		for (var quote in this.quotes) {
			if (quote.includes(cur1 + cur2)) {
				return this.quotes[quote][type]
			}
			if (quote.includes(cur2 + cur1)) {
				return 1 / this.quotes[quote][type]
			}
		}
	};

	var LEVERAGES = {
		micro: [50, 100, 200, 400, 500, 1000, 2000, 3000],
		unlimited: [50, 100, 200, 400, 500],
		ecn: [50, 100, 200, 400, 500],
		standard: [50, 100, 200, 400, 500, 1000, 2000, 3000],
		zero: [50, 100, 200, 400, 500, 1000, 2000, 3000],
		cent: [50, 100, 200, 400, 500, 1000],
		crypto: [5]
	};

	const METALS = ['Palladium', 'Platinum', 'XAGUSD', 'XAUUSD'];
	const isMetal = (currency, array) => array.includes(currency);

	var Calc = function(type, options) {
		this.quotes = {};
		this.swap = {};
		this.elems = [];
	};
	Calc.prototype.init = function() {
		var self = this;

		return promisesAll([
			$.ajax({
				url: '/trading/quotes'
			}),
			$.ajax({
				url: '/trading/calc'
			})
		])
			.then(function(result) {
				// котировки текущие
				self.quotes = result.shift();

				// фильтр с наличием котировок
				var tempSymbols = result.shift();
				self.swap = _.each(tempSymbols, function (symbols, type) {
					_.filter(symbols, function (v) {
						v.account = type;
						v.leverages = self.getLeverage(type);
						v.currencies = self.getCurrency(type);

						if(type == 'micro' && v.symbol.indexOf('m') == 6 && v.symbol.length == 7) {
							v.symbol = v.symbol.slice(0, 6);
						}
						if(type == 'zero' && v.symbol.indexOf('z') == 6 && v.symbol.length == 7) {
							v.symbol = v.symbol.slice(0, 6);
						}
						return !!self.quotes[v.symbol];
					});
				});

				self.symbols = self.getSymbols();
				return self;
			});
	};
	Calc.prototype.getLeverage = function(type) {
		return LEVERAGES[type];
	};
	Calc.prototype.getCurrency = function(type) {
		//Currency — EUC или USC для Cent-счетов, EUR или USD - для остальных
		//Для ecn - только USD
    if (type === 'crypto') {
      return ['USDT'];
    }
		return type !== 'cent' ? (type === 'ecn' ? ['USD'] : ['USD', 'EUR']) : ['USC', 'EUC'];

	};
	Calc.prototype.getSymbols = function() {
		return _.each(this.swap, function(symbols, account) {
			this.swap[account] = _.map(symbols, function (symbol) {
				return _.extend({}, symbol, this.quotes[symbol.symbol]);
			}, this);
		}, this);
	};
	Calc.prototype.calculator = function(val, model) {
	  const correctedCurrency = model.currency === 'USDT' ? 'USD' : model.currency;
		var formulars = {
			contractSize: function(model) {
				return model.contractSize = parseFloat(model.contract_size * model.lot);
			},
			pointValue: function(model) {
				switch (model.calc_mode) {
					case 0:
						return model.pointValue = model.point * model.contract_size * model.lot * getCurrency.call(this, model.second_currency, correctedCurrency, 'bid');
					case 2:
					case 3:
					case 4:
					case 5:
						return model.pointValue = model.point * model.contract_size * model.lot * getCurrency.call(this, model.profit_currency, correctedCurrency, 'bid');
					case 1:
						return model.pointValue = model.point * model.tick_value / model.tick_size * getCurrency.call(this, model.profit_currency, correctedCurrency, 'bid');
				}
			},
			spreadPips: function(model) {
				if (this.account == 'zero') {
					return model.spreadPips = 0;
				}
				if (model.calc_mode == 2 && model.tick_size != 0) {
					return model.spreadPips = (model.ask - model.bid) / model.tick_size;
				}
				return model.spreadPips = (model.ask - model.bid) / model.point;
			},
			spreadCurrency: function(model) {
				return model.spreadCurrency = model.spreadPips * model.pointValue;
			},
			swapLongPips: function(model) {
				return model.swapLongPips = parseFloat(model.swap_long);
			},
			swapLongCurrency: function(model) {
				return model.swapLongCurrency = model.swapLongPips * model.pointValue;
			},
			swapShortPips: function(model) {
				return model.swapShortPips = parseFloat(model.swap_short);
			},
			swapShortCurrency: function(model) {
				return model.swapShortCurrency = model.swapShortPips * model.pointValue;
			},
			swapLongPercent: function(model) {
				return model.swapLongPercent = (model.contractSize * model.ask * model.lot * model.swap_long / 100) / 360 * getCurrency.call(this, model.profit_currency, correctedCurrency, 'ask');
			},
			swapShortPercent: function(model) {
				return model.swapShortPercent = (model.contractSize * model.bid * model.lot * model.swap_short / 100) / 360 * getCurrency.call(this, model.profit_currency, correctedCurrency, 'bid');
			},
			marginResult: function(model) {
				switch (model.calc_mode) {
					case 0:
					case 5:
						return model.marginResult = (model.lot * model.contract_size) / model.leverage * getCurrency.call(this, model.first_currency, model.currency, 'bid');
					case 2:
						return model.marginResult = model.lot * model.contract_size * model.margin_initial_buy * model.bid * getCurrency.call(this, model.margin_currency, correctedCurrency, 'bid');
					case 1:
						return model.marginResult = model.lot * model.margin_initial * model.margin_initial_buy * getCurrency.call(this, model.margin_currency, correctedCurrency, 'bid');
				}
			}
		}
		return formulars[val].call(this, model);
	};
	Calc.prototype.calculate = function(models) {
		return _.map(models, function(model) {
			model.currency = model.currency || model.currencies[0];
			model.lot = model.lot || 1;
			model.leverage = model.leverage || model.leverages[0];
			if(model.calc_mode < 2) {
				model.second_currency = model.symbol.slice(3, 6);
				model.first_currency = model.symbol.slice(0, 3);
			}
			if (this.account === 'cent') model.contractSize = model.contractSize / 100;
			return {
				isMetal: isMetal(model.symbol, METALS),
				isStock: model.swap_mode === 6,
				currency: model.currency || this.currency[0],
				contractSize: this.calculator('contractSize', model).toFixed(2),
				pointValue: this.calculator('pointValue', model).toFixed(model.account === 'crypto' ? 6 : 2),
				spreadPips: this.calculator('spreadPips', model).toFixed(2),
				spreadCurrency: this.calculator('spreadCurrency', model).toFixed(2),
				swapLongPips: this.calculator('swapLongPips', model).toFixed(2),
				swapLongCurrency: this.calculator('swapLongCurrency', model).toFixed(2),
				swapLongPercent: this.calculator('swapLongPercent', model).toFixed(2),
				swapShortPips: this.calculator('swapShortPips', model).toFixed(2),
				swapShortCurrency: this.calculator('swapShortCurrency', model).toFixed(2),
				swapShortPercent: this.calculator('swapShortPercent', model).toFixed(2),
				marginResult: this.calculator('marginResult', model).toFixed(2)
			};
		}, this);
	};
	Calc.prototype.addSymbol = function(item, type) {
		var self = this;
		var model = _.clone(this.symbols[type][item - 1]);
		var elem = $('.accounts_calc-container');
		var elemsObj = {
			model: model,
			elem: elem,
			symbol: elem.find('.item-' + item + ' .calc-template-symbol'),
			lot: elem.find('.item-' + item + ' .calc-template-lot').val(1),
			currency: elem.find('.item-' + item + ' .calc-template-currency'),
			leverage: elem.find('.item-' + item + ' .calc-template-leverage'),
			account: elem.find('.item-' + item + ' .calc-template-account').val(model.account),
			ask: elem.find('.item-' + item + ' .calc-template-ask').val(typeof model.ask==="number"?model.ask.toFixed(model.digits):model.ask),
			bid: elem.find('.item-' + item + ' .calc-template-bid').val(typeof model.bid==="number"?model.bid.toFixed(model.digits):model.bid),
		};
		this.elems.push(elemsObj);

		elemsObj.account[0].selectize && elemsObj.account[0].selectize.destroy();
		elemsObj.account.selectize({
			render: getSelectizeRender('account'),
			onChange: function(type) {
				model.account = type;
				elemsObj.model = _.clone(_.first(self.symbols[model.account]));

				var symSelect = elemsObj.symbol[0].selectize;
				symSelect.clearOptions();
				symSelect.addOption(self.symbols[model.account]);
				symSelect.setValue(elemsObj.model.symbol);


				var curSelect = elemsObj.currency[0].selectize;
				curSelect.clearOptions();
				curSelect.addOption(toSelect(elemsObj.model.currencies));
				curSelect.setValue(elemsObj.model.currency = elemsObj.model.currencies[0]);

				var levSelect = elemsObj.leverage[0].selectize;
				levSelect.clearOptions();
				levSelect.addOption(_.map(elemsObj.model.leverages, function(val) {
					return {
						value: val,
						name: '1:' + val
					}
				}));
				levSelect.setValue(elemsObj.model.leverage = elemsObj.model.leverages[0]);

				elemsObj.lot.val(elemsObj.model.lot = 1);
				elemsObj.ask.val(typeof elemsObj.model.ask==="number"?elemsObj.model.ask.toFixed(elemsObj.model.digits):elemsObj.model.ask);
				elemsObj.bid.val(typeof elemsObj.model.bid==="number"?elemsObj.model.bid.toFixed(elemsObj.model.digits):elemsObj.model.bid);

			}
		});

		elemsObj.symbol[0].selectize && elemsObj.symbol[0].selectize.destroy();
		//for symbols selectize
		elemsObj.symbol.selectize({
			valueField: 'symbol',
			items: [model.symbol],
			options: this.symbols[model.account],
			render: getSelectizeRender('symbol'),
			onChange: function(val) {
				if(!val) return;
				elemsObj.model = _.clone(_.findWhere(self.symbols[model.account], {
					symbol: val
				}));

				elemsObj.currency[0].selectize.setValue(elemsObj.model.currency = elemsObj.model.currencies[0]);
				elemsObj.leverage[0].selectize.setValue(elemsObj.model.leverage = elemsObj.model.leverages[0]);
				elemsObj.lot.val(elemsObj.model.lot = 1);
				elemsObj.ask.val(typeof elemsObj.model.ask==="number"?elemsObj.model.ask.toFixed(elemsObj.model.digits):elemsObj.model.ask);
				elemsObj.bid.val(typeof elemsObj.model.bid==="number"?elemsObj.model.bid.toFixed(elemsObj.model.digits):elemsObj.model.bid);
			}
		});

		elemsObj.currency[0].selectize && elemsObj.currency[0].selectize.destroy();
		elemsObj.currency.selectize({
			valueField: 'value',
			items: [_.first(model.currencies)],
			options: toSelect(model.currencies),
			render: getSelectizeRender('value'),
			onChange: _getOnChangeFunc('currency')
		});

		elemsObj.leverage[0].selectize && elemsObj.leverage[0].selectize.destroy();
		elemsObj.leverage.selectize({
			valueField: 'value',
			items: [_.first(model.leverages)],
			options: _.map(model.leverages, function(val) {
				return {
					value: val,
					name: '1:' + val
				}
			}),
			render: getSelectizeRender('name'),
			onChange: _getOnChangeFunc('leverage')
		});

		elemsObj.lot.on('change', getOnChangeFunc('lot'));
		elemsObj.ask.on('change', getOnChangeFunc('ask'));
		elemsObj.bid.on('change', getOnChangeFunc('bid'));

		function _getOnChangeFunc(value) {
			return function(val) {
				elemsObj.model[value] = val;
			}
		}

		function getOnChangeFunc(value) {
			var func = _getOnChangeFunc(value)
			return function(e) {
				func(this.value)
			}
		}

		return elem;
	};

	$.fn.traderCalculator = function(type) {
		if (!this.length) return;

		var accountType = type || this.data('type') || 'standard',
			$resultsContainer = $('.calc-table-results'),
			$resultsButton = $('.accounts_calc-button'),

			initSucceess = function(calc) {
				var rows = 1;
				while (rows < 6) {
					calc.addSymbol(rows, accountType);
					rows++;
				}
				checkout();
				$resultsButton.on('click', checkout);

				function checkout(e) {
					if (e) {
						e.stopPropagation();
						e.preventDefault();
					}
					$resultsContainer.removeClass('hide');
					_.each(calc.calculate(_.pluck(calc.elems, 'model')), function(model, item) {
						item = item + 1;
						$resultsContainer.find('.calc-contractSize .item-' + item).text(model.contractSize);
						$resultsContainer.find('.calc-pointValue .item-' + item).text(model.pointValue < .000001 ? '<0.000001' + ' ' + model.currency : model.pointValue + ' ' + model.currency);
						$resultsContainer.find('.calc-spread .item-' + item).html('<div class="list list_simple"><ul><li>' + model.spreadPips + ' pips</li><li>' + model.spreadCurrency + ' ' + model.currency + '</li></ul></div>');
						$resultsContainer.find('.calc-swapBuy .item-' + item).html('<div class="list list_simple"><ul><li>' + `${model.isMetal ? '' : model.isStock ? model.swapLongPips + '%</li><li>' : model.swapLongPips +' pips</li><li>'}` + `${model.isStock ? model.swapLongPercent : model.swapLongCurrency}` + ' ' + model.currency + '</li></ul></div>');
						$resultsContainer.find('.calc-swapSell .item-' + item).html('<div class="list list_simple"><ul><li>'+ `${model.isMetal ? '' : model.isStock ? model.swapShortPips + '%</li><li>' : model.swapShortPips +' pips</li><li>'}` + `${model.isStock ? model.swapShortPercent : model.swapShortCurrency}` + ' ' + model.currency + '</li></ul></div>');
						$resultsContainer.find('.calc-margin .item-' + item).text(model.marginResult + ' ' + model.currency);
					});
				}
			}

		var Calculator = new Calc(accountType);
		Calculator.init().then(initSucceess);
	};
	$('.account-calc').traderCalculator();
});
