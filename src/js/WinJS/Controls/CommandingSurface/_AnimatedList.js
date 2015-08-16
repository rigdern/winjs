define([
], function () {
    var ClassNames = {
        animatedList: "win-animatedlist",
        removing: "win-animatedlist-removing"
    };
    
    // Returns elements of `a` that aren't in `b`
    function arrayDiff(a, b) {
        return a.filter(function (aEl) {
            return b.indexOf(aEl) === -1;
        });
    }
    
    var AnimatedList = WinJS.Class.define(function (element, options) {
        this._initializeDom(element || document.createElement("div"));
        this._rendered = {
            items: []
        };
        this._items = [];
        this._animationPromise = null;
        this._animating = false;
        this._queued = false;
    }, {
        children: {
            get: function () {
                return this._items;
            },
            set: function (value) {
                this._items = value.slice(0);
                this._updateDom();
            }
        },
        childernInDom: {
            get: function () {
                return this._rendered.items;
            },
            set: function (value) {
                this._items = value.slice(0);
                this._updateDomWithoutAnimations();
            }
        },
        appendChild: function (element) {
            this.removeChild(element);
            this._rendered.items.push(element);
            this._dom.root.appendChild(element);
        },
        removeChild: function (element) {
            var index = this._rendered.items.indexOf(element);
            if (index !== -1) {
                this._rendered.items.splice(index, 1);
                this._dom.root.removeChild(element);
            }
        },
        _initializeDom: function (root) {
            root.classList.add(ClassNames.animatedList);
            
            this._dom = {
                root: root
            };
        },
        _updateDomWithoutAnimations: function () {
            if (this._animationPromise) {
                this._queued = false;
                this._animationPromise.cancel();
            }
            
            var rendered = this._rendered;
            
            var prevItems = rendered.items;
            var nextItems = this._items;
            
            prevItems.forEach(function (e) {
                e.parentNode && e.parentNode.removeChild(e);
            });
            nextItems.forEach(function (e) {
                this._dom.root.appendChild(e);
            }, this);
        },
        _updateDom: function () {
            if (this._animationPromise) {
                this._queued = true;
                return;
            }
            
            var rendered = this._rendered;
            
            var prevItems = rendered.items;
            var nextItems = this._items;
            
            var added = arrayDiff(nextItems, prevItems);
            var removed = arrayDiff(prevItems, nextItems);
            var affected = arrayDiff(prevItems, removed);
            
            var animation = WinJS.UI.Animation._createUpdateListAnimation(added, removed, affected);
            
            prevItems.forEach(function (e) {
                e.parentNode && e.parentNode.removeChild(e);
            });
            nextItems.forEach(function (e) {
                this._dom.root.appendChild(e);
            }, this);
            removed.forEach(function (e) {
                e.classList.add(ClassNames.removing);
                this._dom.root.appendChild(e);
            }, this);
            
            rendered.items = nextItems;
            
            this._animationPromise = animation.execute().then(function () {
                removed.forEach(function (e) {
                    e.classList.remove(ClassNames.removing);
                    e.parentNode && e.parentNode.removeChild(e);
                });
                this._animationPromise = null;
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