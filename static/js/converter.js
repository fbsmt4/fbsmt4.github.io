var currency = (function () {
    //--data--//
    var curData = {
        rate: 0.85,
        original: 'USD',
        target: 'EUR',
        chart: {
            labels: ['SEP', '', '', '', '', 'NOV', '', '', '', '', 'JAN', '', '', '', '', 'MAR', '', '', '', '', 'MAY', '', '', '', ''],
            series: [
                [0.86, 0.85, 0.83, 0.93, 0.95, 0.95, 0.85, 0.80, 0.83, 0.80, 0.79, 0.77, 0.75, 0.75, 0.76, 0.75, 0.77, 0.78]
            ]
        }
    };
    var currencies = [
        {flag: "us", name: "USD"},
        {flag: "eu", name: "EUR"}
    ];
    var innerUrl = '/currency-inner/';
    var currencyUrl = '/currency/';

    //--ui--//
    var ui = {
        $original: $('.js-cur__original'),
        $target: $('.js-cur__target'),
        $rateO: $('.js-cur__rate-o'),
        $rateT: $('.js-cur__rate-t'),
        $linkO: $('.js-cur__link-o'),
        $linkT: $('.js-cur__link-t'),
        $amount: $('.js-cur__amount'),
        $input: $('.js-cur__input'),
        $output: $('.js-cur__output'),
        $selectO: $('.js-cur__select-o'),
        $selectT: $('.js-cur__select-t'),
        $swap: $('.js-cur__swap'),
        $chart: $('.js-cur__chart')
    };

    var initParams = function(data, curr, url, currency) {
        curData = data;
        currencies = curr;
        innerUrl = url;
        currencyUrl = currency;
    };

    var init = function(data, curr, url, currency) {
        initParams(data, curr, url, currency);
        initSelect();
        initInput();
        initChart();
        initSwap();
        setSelect();
        setValues();
    };

    //--init--//
    var initSelect = function () {
        $('.js-cur__select').selectize({
            maxItems: 1,
            labelField: 'name',
            valueField: 'name',
            options: currencies,
            preload: true,
            persist: false,
            hideSelected: false,
            render: {
                item: function (item, escape) {
                    return "<div class='form__option'><i class='flag flag-" + escape(item.flag) + "' ></i>&nbsp;" + "<span>" + escape(item.name) + "</span></div>";
                },
                option: function (item, escape) {
                    return "<div class='form__option'><i class=' flag flag-" + escape(item.flag) + "' ></i>&nbsp;" + "<span>" + escape(item.name) + "</span></div>";
                }
            },
            onChange: function (value) {
                $.ajax(currencyUrl + $('.js-cur__select-o').val() + $('.js-cur__select-t').val(), {
                    method: 'GET'
                }).success(function (response) {
                    initParams(response, currencies, innerUrl, currencyUrl);
                    setValues();
                    setInput();
                    initChart();
                });
            }
        });
    };
    var initChart = function () {
        if(ui.$chart[0]) {
            new Chartist.Line(ui.$chart[0], curData.chart, {
                chartPadding: 20
            });
        }
    };
    var initInput = function () {
        ui.$input.val(0);
        ui.$input.on("keyup", function () {
            setInput();
        }).on("keydown", function (e) {
            if ((this.value.length > 14 || ui.$output.text().length > 14) && (e.which != 8 && e.which != 0)) return false;
        });
    };
    var initSwap = function () {
        ui.$swap.on("click", function (e) {
            e.preventDefault();
            swapData();
            setValues();
            setInput();
            setSelect();
            initChart();
        });
    };

    //--set--//
    var setValues = function () {
        ui.$original.html(curData.original);
        ui.$target.html(curData.target);
        ui.$linkO.attr("href", innerUrl + curData.original);
        ui.$linkT.attr("href", innerUrl + curData.target);
        ui.$rateO.html(Number(curData.rate).toFixed(5));
        curData.rate ? ui.$rateT.html((1 / Number(curData.rate)).toFixed(5)) : ui.$rateT.html(Number(curData.rate).toFixed(5));
    };
    var setSelect = function () {
        if(ui.$selectO[0]) ui.$selectO[0].selectize.setValue(curData.original, true);
        if(ui.$selectT[0]) ui.$selectT[0].selectize.setValue(curData.target, true);
    };
    var setInput = function () {
        ui.$output.html(convert(ui.$input.val(), curData.rate).toFixed(2));
        formatAmount();
    };

    //--helpers--//
    var formatAmount = function(){
        if (ui.$input.val().length < 6 && ui.$output.text().length < 6) {
            ui.$amount.removeClass('currency-converter__amount_sm currency-converter__amount_xs');
        }
        else if (ui.$input.val().length < 11 && ui.$output.text().length < 11) {
            ui.$amount.addClass('currency-converter__amount_sm');
        }
        else {
            ui.$amount.addClass('currency-converter__amount_xs');
        }
    };
    var convert = function (input, rate) {
        return input * rate;
    };
    var swapData = function () {
        var original = curData.original,
            series = curData.chart.series[0];
        curData.rate = 1 / curData.rate;
        curData.original = curData.target;
        curData.target = original;
        for (var i = 0; i < series.length; i++) {
            series[i] = series[i] === 0 ? 0 : 1 / series[i];
        }
    };

    return {
        ui: ui,
        initSelect: initSelect,
        initChart: initChart,
        initInput: initInput,
        initSwap: initSwap,
        initParams: initParams,
        init: init
    }
})();