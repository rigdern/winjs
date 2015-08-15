define([
], function () {
    // Returns elements of `a` that aren't in `b`
    function arrayDiff(a, b) {
        return a.filter(function (aEl) {
            return b.indexOf(aEl) === -1;
        });
    }
    
    var AnimatedList = WinJS.Class.define(function (element, options) {
        element.style.position = "relative";
        this._dom = {
            root: element
        };
        this._rendered = {
            items: []
        };
        this._items = [];
        this._animating = false;
        this._queued = false;
    }, {
        setItems: function (items, options) {
            options = options || {};
            var skipAnimations = options.skipAnimations;
            this._items = items.slice(0); // defensive copy
            this._updateDom();
        },
        _updateDom: function () {
            if (this._animating) {
                this._queued = true;
                return;
            }
            
            var rendered = this._rendered;
            
            var prevItems = rendered.items;
            var newItems = this._items;
            
            var added = arrayDiff(newItems, prevItems);
            var removed = arrayDiff(prevItems, newItems);
            var affected = arrayDiff(prevItems, removed);
            
            var animation = WinJS.UI.Animation._createUpdateListAnimation(added, removed, affected);
            
            prevItems.forEach(function (e) {
                e.parentNode && e.parentNode.removeChild(e);
            });
            newItems.forEach(function (e) {
                this._dom.root.appendChild(e);
            }, this);
            removed.forEach(function (e) {
                e.classList.add("win-removing");
                this._dom.root.appendChild(e);
            }, this);
            
            rendered.items = newItems;
            
            this._animating = true;
            animation.execute().then(function () {
                removed.forEach(function (e) {
                    e.classList.remove("win-removing");
                    e.parentNode && e.parentNode.removeChild(e);
                });
                this._animating = false;
                if (this._queued) {
                    this._queued = false;
                    this._updateDom();
                }
            }.bind(this));
        }
    });
    
    WinJS.Namespace.define("WinJS.UI", {
        AnimatedList: AnimatedList
    });
});