/**
 * The following features are still outstanding: animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html tooltips, and selector delegation.
 */
angular.module('ui.bootstrap.tooltip', [ 'ui.bootstrap.position', 'ui.bootstrap.bindHtml' ])

/**
 * The $tooltip service creates tooltip- and popover-like directives as well as
 * houses global options for them.
 */
    .provider('$tooltip', function () {
        // The default options tooltip and popover.
        var defaultOptions = {
            placement: 'top',
            animation: true,
            popupDelay: 0
        };

        // Default hide triggers for each show trigger
        var triggerMap = {
            'mouseenter': 'mouseleave',
            'click': 'click',
            'focus': 'blur'
        };

        // The options specified to the provider globally.
        var globalOptions = {};

        /**
         * `options({})` allows global configuration of all tooltips in the
         * application.
         *
         *   var app = angular.module( 'App', ['ui.bootstrap.tooltip'], function( $tooltipProvider ) {
   *     // place tooltips left instead of top by default
   *     $tooltipProvider.options( { placement: 'left' } );
   *   });
         */
        this.options = function (value) {
            angular.extend(globalOptions, value);
        };

        /**
         * This allows you to extend the set of trigger mappings available. E.g.:
         *
         *   $tooltipProvider.setTriggers( 'openTrigger': 'closeTrigger' );
         */
        this.setTriggers = function setTriggers(triggers) {
            angular.extend(triggerMap, triggers);
        };

        /**
         * This is a helper function for translating camel-case to snake-case.
         */
        function snake_case(name) {
            var regexp = /[A-Z]/g;
            var separator = '-';
            return name.replace(regexp, function (letter, pos) {
                return (pos ? separator : '') + letter.toLowerCase();
            });
        }

        /**
         * Returns the actual instance of the $tooltip service.
         * TODO support multiple triggers
         */
        this.$get = [ '$window', '$compile', '$timeout', '$parse', '$document', '$position', '$interpolate', function ($window, $compile, $timeout, $parse, $document, $position, $interpolate) {
            return function $tooltip(type, prefix, defaultTriggerShow) {
                var options = angular.extend({}, defaultOptions, globalOptions);

                /**
                 * Returns an object of show and hide triggers.
                 *
                 * If a trigger is supplied,
                 * it is used to show the tooltip; otherwise, it will use the `trigger`
                 * option passed to the `$tooltipProvider.options` method; else it will
                 * default to the trigger supplied to this directive factory.
                 *
                 * The hide trigger is based on the show trigger. If the `trigger` option
                 * was passed to the `$tooltipProvider.options` method, it will use the
                 * mapped trigger from `triggerMap` or the passed trigger if the map is
                 * undefined; otherwise, it uses the `triggerMap` value of the show
                 * trigger; else it will just use the show trigger.
                 */
                function getTriggers(trigger) {
                    var show = trigger || options.trigger || defaultTriggerShow;
                    var hide = triggerMap[show] || show;
                    return {
                        show: show,
                        hide: hide
                    };
                }

                var directiveName = snake_case(type);

                var startSym = $interpolate.startSymbol();
                var endSym = $interpolate.endSymbol();
                var template =
                    '<' + directiveName + '-popup ' +
                        'title="' + startSym + 'tt_title' + endSym + '" ' +
                        'content="' + startSym + 'tt_content' + endSym + '" ' +
                        'placement="' + startSym + 'tt_placement' + endSym + '" ' +
                        'animation="tt_animation()" ' +
                        'is-open="tt_isOpen"' +
                        'compile-scope="$parent"' +
                        '>' +
                        '</' + directiveName + '-popup>';
                var possiblePlacements = ['right', 'bottom', 'left', 'top'];

                return {
                    restrict: 'EA',
                    scope: true,
                    link: function link(scope, element, attrs) {
                        var target = element;
                        var tooltip = $compile(template)(scope);
                        var transitionTimeout;
                        var popupTimeout;
                        var $body;
                        var appendToBody = angular.isDefined(options.appendToBody) ? options.appendToBody : false;
                        var triggers = getTriggers(undefined);
                        var hasRegisteredTriggers = false;
                        var requestedPlacement;
                        var bodyPosition;

                        // By default, the tooltip is not open.
                        // TODO add ability to start tooltip opened
                        scope.tt_isOpen = false;

                        function toggleTooltipBind() {
                            if (!scope.tt_isOpen) {
                                showTooltipBind();
                            } else {
                                hideTooltipBind();
                            }
                        }

                        // Show the tooltip with delay if specified, otherwise show it immediately
                        function showTooltipBind() {
                            if (scope.tt_popupDelay) {
                                popupTimeout = $timeout(show, scope.tt_popupDelay);
                            } else {
                                scope.$apply(show);
                            }
                        }

                        function hideTooltipBind() {
                            scope.$apply(function () {
                                hide();
                            });
                        }

                        // Show the tooltip popup element.
                        function show() {
                            // Don't show already shown or empty tooltips.
                            if (scope.tt_isOpen || !scope.tt_content) {
                                return;
                            }

                            // If there is a pending remove transition, we must cancel it, lest the
                            // tooltip be mysteriously removed.
                            if (transitionTimeout) {
                                $timeout.cancel(transitionTimeout);
                            }

                            // Now we add it to the DOM because need some info about it. But it's not
                            // visible yet anyway.
                            if (appendToBody) {
                                $body = $body || $document.find('body');
                                $body.append(tooltip);
                            } else {
                                target.after(tooltip);
                            }

                            position();

                            // And show the tooltip.
                            scope.tt_isOpen = true;
                        }

                        // Hide the tooltip popup element.
                        function hide(destroy) {
                            if (!scope.tt_isOpen) {
                                return;
                            }

                            // First things first: we don't show it anymore.
                            scope.tt_isOpen = false;

                            //if tooltip is going to be shown after delay, we must cancel this
                            $timeout.cancel(popupTimeout);

                            // And now we remove it from the DOM. However, if we have animation, we
                            // need to wait for it to expire beforehand.
                            // FIXME: this is a placeholder for a port of the transitions library.
                            if (angular.isDefined(scope.tt_animation) && scope.tt_animation()) {
                                transitionTimeout = $timeout(function () {
                                    remove(destroy);
                                }, 500);
                            } else {
                                remove(destroy);
                            }
                        }

                        function remove(destroy) {
                            if (destroy) {
                                tooltip.remove();
                            } else {
                                angular.forEach(tooltip, function (e) {
                                    e.parentNode.removeChild(e);
                                });
                            }
                        }

                        function intersection(r1, r2) {
                            if (r1.x1 < r2.x1) r1.x1 = r2.x1;
                            if (r1.y1 < r2.y1) r1.y1 = r2.y1;
                            if (r1.x2 > r2.x2) r1.x2 = r2.x2;
                            if (r1.y2 > r2.y2) r1.y2 = r2.y2;
                            r1.x2 -= r1.x1;
                            r1.y2 -= r1.y1;
                            return {
                                x: r1.x1,
                                y: r1.y1,
                                width: r1.x2,
                                height: r1.y2
                            };
                        }

                        function position() {
                            var targetPosition,
                                ttWidth,
                                ttHeight,
                                ttPosition,
                                bestPlacement = undefined;

                            // Set the initial positioning.
                            tooltip.css({ top: 0, left: 0, display: 'block' });

                            // Get the position of the target element.
                            targetPosition = appendToBody ? $position.offset(target) : $position.position(target);

                            // Get the height and width of the tooltip so we can center it.
                            ttWidth = tooltip.prop('offsetWidth');
                            ttHeight = tooltip.prop('offsetHeight');

                            // Run through all possible placements starting with the requested placement to find
                            // one that does not clip the tooltip. If all placement options result in clipping
                            // then use the requested placement and let it be clipped.
                            var i;
                            for (i = 0; i < possiblePlacements.length; i++) {
                                if (requestedPlacement === possiblePlacements[i]) {
                                    break;
                                }
                            }
                            var startIndex = i;

                            if (appendToBody) {
                                bodyPosition = $position.offset($body);
                            }

                            while (true) {
                                // Calculate the tooltip's top and left coordinates to center it with
                                // the target element.
                                switch (possiblePlacements[i]) {
                                    case 'right':
                                        ttPosition = {
                                            top: targetPosition.top + targetPosition.height / 2 - ttHeight / 2,
                                            left: targetPosition.left + targetPosition.width
                                        };
                                        break;
                                    case 'bottom':
                                        ttPosition = {
                                            top: targetPosition.top + targetPosition.height,
                                            left: targetPosition.left + targetPosition.width / 2 - ttWidth / 2
                                        };
                                        break;
                                    case 'left':
                                        ttPosition = {
                                            top: targetPosition.top + targetPosition.height / 2 - ttHeight / 2,
                                            left: targetPosition.left - ttWidth
                                        };
                                        break;
                                    default:
                                        ttPosition = {
                                            top: targetPosition.top - ttHeight,
                                            left: targetPosition.left + targetPosition.width / 2 - ttWidth / 2
                                        };
                                        break;
                                }

                                if (!appendToBody) {
                                    break;
                                }

                                // Check if the computed position results in clipping. If so, advance the
                                // index (wrapping it around if necessary) to point to the next possible
                                // placement and go through the loop again to try it. Once the index returns
                                // back to the requested placement we know that all placements resulted in
                                // clipping. If so, use the placement that resulted in the smallest clipping.
                                var rect = intersection(
                                    {
                                        x1: ttPosition.left,
                                        y1: ttPosition.top,
                                        x2: ttPosition.left + ttWidth,
                                        y2: ttPosition.top + ttHeight
                                    },
                                    {
                                        x1: 0,
                                        y1: 0,
                                        x2: bodyPosition.width,
                                        y2: bodyPosition.height
                                    }
                                );
                                if (rect.width < ttWidth || rect.height < ttHeight) {
                                    var area = rect.width * rect.height;
                                    if (!bestPlacement || bestPlacement.area < area) {
                                        bestPlacement = { area: area, position: ttPosition, placement: possiblePlacements[i] };
                                    }
                                    i++;
                                    if (i >= possiblePlacements.length) {
                                        i = 0;
                                    }
                                    if (i === startIndex) {
                                        ttPosition = bestPlacement.position;
                                        scope.tt_placement = bestPlacement.placement;
                                        break;
                                    }
                                } else {
                                    // If a placement is found that does not clip the tooltip - set it
                                    scope.tt_placement = possiblePlacements[i];
                                    break;
                                }
                            }

                            ttPosition.top += 'px';
                            ttPosition.left += 'px';

                            // Now set the calculated positioning.
                            tooltip.css(ttPosition);
                        }

                        /**
                         * Observe the relevant attributes.
                         */
                        attrs.$observe(type, function (val) {
                            scope.tt_content = val;
                        });

                        attrs.$observe(prefix + 'Title', function (val) {
                            scope.tt_title = val;
                        });

                        attrs.$observe(prefix + 'Placement', function (val) {
                            requestedPlacement = angular.isDefined(val) ? val : options.placement;
                        });

                        attrs.$observe(prefix + 'Animation', function (val) {
                            scope.tt_animation = angular.isDefined(val) ? $parse(val) : function () {
                                return options.animation;
                            };
                        });

                        attrs.$observe(prefix + 'PopupDelay', function (val) {
                            var delay = parseInt(val, 10);
                            scope.tt_popupDelay = !isNaN(delay) ? delay : options.popupDelay;
                        });

                        attrs.$observe(prefix + 'Trigger', function (val) {
                            if (val != 'manual') {
                                if (hasRegisteredTriggers) {
                                    target.unbind(triggers.show, showTooltipBind);
                                    target.unbind(triggers.hide, hideTooltipBind);
                                }

                                triggers = getTriggers(val);

                                if (triggers.show === triggers.hide) {
                                    target.bind(triggers.show, toggleTooltipBind);
                                } else {
                                    target.bind(triggers.show, showTooltipBind);
                                    target.bind(triggers.hide, hideTooltipBind);
                                }

                                hasRegisteredTriggers = true;
                            }
                        });

                        attrs.$observe(prefix + 'AppendToBody', function (val) {
                            appendToBody = angular.isDefined(val) ? $parse(val)(scope) : appendToBody;
                        });

                        scope.$watch(attrs[prefix + 'Visible'], function (val) {
                            if (val && !scope.tt_isOpen) {
                                $timeout(show);
                            } else if (!val && scope.tt_isOpen) {
                                $timeout(hide);
                            }
                        });

                        scope.$watch(attrs[prefix + 'Target'], function (val) {
                            if (scope.tt_isOpen && target !== val) {
                                if (target)
                                    $timeout(hide);
                                target = val;
                                if (val)
                                    $timeout(show);
                            } else {
                                target = val;
                            }
                        });

                        // Reposition the tooltip if necessary when the size of the content changes
                        scope.$watch(function() {
                            return tooltip.prop('clientWidth');
                        }, function (value, oldValue) {
                            if (oldValue > 0 && value > 0) {
                                position();
                            }
                        });

                        // if a tooltip is attached to <body> we need to remove it on
                        // location change as its parent scope will probably not be destroyed
                        // by the change.
                        if (appendToBody) {
                            scope.$on('$locationChangeSuccess', function closeTooltipOnLocationChangeSuccess() {
                                if (scope.tt_isOpen) {
                                    hide();
                                }
                            });
                        }

                        // Make sure tooltip is destroyed and removed.
                        scope.$on('$destroy', function onDestroyTooltip() {
                            if (scope.tt_isOpen) {
                                hide(true);
                            } else {
                                remove(true);
                            }
                        });
                    }
                };
            };
        }];
    })

    .directive('tooltipPopup', function () {
        return {
            restrict: 'E',
            replace: true,
            scope: { content: '@', placement: '@', animation: '&', isOpen: '&' },
            templateUrl: 'template/tooltip/tooltip-popup.html'
        };
    })

    .directive('tooltip', [ '$tooltip', function ($tooltip) {
        return $tooltip('tooltip', 'tooltip', 'mouseenter');
    }])

    .directive('tooltipHtmlUnsafePopup', function () {
        return {
            restrict: 'E',
            replace: true,
            scope: { content: '@', placement: '@', animation: '&', isOpen: '&' },
            templateUrl: 'template/tooltip/tooltip-html-unsafe-popup.html'
        };
    })

    .directive('tooltipHtmlUnsafe', [ '$tooltip', function ($tooltip) {
        return $tooltip('tooltipHtmlUnsafe', 'tooltip', 'mouseenter');
    }]);

