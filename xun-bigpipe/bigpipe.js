/**
 * Created by xun on 15-2-19.
 */
var async = require('async')
    ,_ = require('underscore')
    ,ejs = require('ejs');

exports.init = function(req, res, next){
    //res.set('Transfer-Encoding','chunked');
    var bigPipe = new BigPipe();
    _.extend(res, bigPipe);

    next();
}

function BigPipe(){
    //widget 模块个数【默认为零个】
    this.size = 0;
    //需要同步加载的对象
    this.async = {
        total: 0,
        index: 0
    };
    this.widgets = {};
    this.arrWidgets = [];
}


//根据组件ID，绑定回调函数
BigPipe.prototype.bind = function(id, fn){
    var that = this;
    fn(function(err, data){
        if(err){
            console.log(err);
            return;
        }
        var fileName = that.widgets[id].path;
        ejs.renderFile(that.app.settings.views+'/'+fileName+".ejs", data, function(err, html){
            that._pipe(id, err, html);
        });
    });
}

BigPipe.prototype.pipe = function(view, option){
    var that = this;
    ejs.renderFile(this.app.settings.views+'/'+view+".ejs", option, function(err, html){
        var _html = that.parse(html);
        that.write(_html);
        if(that.size == 0){
            that.end();
        }
    });
}

//chunk输出
BigPipe.prototype._pipe = function(id, err, html){
    if(err){
        console.log('===========this is hock err=============');
        console.log(err);
        this.write('抱歉！跑掉了');
    }else{
        var _html = this.parse(html);
        var data = this.wrap(id, _html);
        this.widgets[id].data = data;
        if(this.widgets[id].model === 'pipeline'){
            if(this.widgets[id].asyncIndex == this.async.index){
                for(var i in this.arrWidgets){
                    var item = this.arrWidgets[i];
                    if(!item.send && item.data && item.asyncIndex>=this.widgets[id].asyncIndex){
                        item.send = true;
                        this.size--;
                        this.write(item.data);
                    }
                }
            }
            else{
                this.widgets[id].data = data;
            }
        }else{
            this.size--;
            this.write(data);
        }
        if(this.size == 0){
            this.end();
        }
    }
}

BigPipe.prototype.wrap = function(id, html){
    //html = html.replace(/['|"]/g,'\\"').replace(/\//g,'\\/').replace(/\n/g,'');
    html = html.replace(/['|"|\/]/g,'\\$&').replace(/\n/g,'');
    var HTML = ['<script>','$("#',id,'").replaceWith("',html,'")','</script>'];
    return HTML.join('');
}

//解析Body字符串
BigPipe.prototype.parse = function(html){
    var widget_regex = /{{\s*widget.*}}/gi;//匹配模块的正则表达式
    var param_regex = /\w+\s*=\s*['|"]\s*\w+\s*['|"]/gi;//匹配属性正在表达式
    var that = this;
    var widgets = html.match(widget_regex)||[];
    for(var i in widgets){
        var item = parseParams(widgets[i]);
        //过滤掉模式为手动加载的组件
        if(item.model !== 'quick'){
            this.widgets[item.id] = item;
            this.arrWidgets.push(item);
        }
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
            <!--pipeline按序自动输出 quick手动加载 async自动输出-->
            //统计需要按序输出的组件
            if('pipeline' === node.model){
                node.asyncIndex = that.async.total;
                that.async.total++;
            }
        }
        html = html.replace(nodeHtml, '<span id="'+node.id+'"></span>');
        return node;
    }

    return html;
}

