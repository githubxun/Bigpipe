/**
 * Created by xun on 15-2-19.
 */
var async = require('async')
    ,_ = require('underscore')
    ,ejs = require('ejs');

exports.init = function(req, res, next){
    res.BigPipe = new BigPipe(res);
    //res.set('Transfer-Encoding','chunked');
    next();
}

function BigPipe(_res){
    //express res对象
    this.res = _res;
    //widget 模块个数【默认为零个】
    this.size = 0;
    this.widgets = {};
}


//根据组件ID，绑定回调函数
BigPipe.prototype.bind = function(id, fn){
    var that = this;
    fn(function(err, data){
        that.size--;

        if(err){
            console.log(err);
            return;
        }
        var path = that.res.app.settings.views||'';
        var fileName = that.widgets[id].path;
        ejs.renderFile(path+'/'+fileName+".ejs", data, function(err, html){
            that.pipe(err, html);
        });
    });
}

//chunk输出
BigPipe.prototype.pipe = function(err, html){
    if(err){
        console.log('===========this is hock err=============');
        console.log(err);
        this.res.write('抱歉！跑掉了');
    }else{
        var _html = this.parse(html);
        this.res.write(_html);
        if(this.size == 0){
            this.res.end();
        }
    }
}

//解析Body字符串
BigPipe.prototype.parse = function(html){
    var widget_regex = /{{\s*widget.*}}/gi;//匹配模块的正则表达式
    var param_regex = /\w+\s*=\s*['|"]\s*\w+\s*['|"]/gi;//匹配属性正在表达式

    var widgets = html.match(widget_regex)||[];
    for(var i in widgets){
        var item = parseParams(widgets[i]);
        this.widgets[item.id] = item;
    }
    this.size = this.size + widgets.length;

    //解析节点
    function parseParams(nodeHtml){
        var node = {};
        var params = nodeHtml.match(param_regex);
        for(var i in params){
            params[i] = params[i].replace(/[\s|'|"]/g,'');
            var arr = params[i].split('=');
            node[arr[0]] = arr[1];
        }
        html = html.replace(nodeHtml, '<span id="'+node.id+'"></span>');
        return node;
    }

    return html;
}

