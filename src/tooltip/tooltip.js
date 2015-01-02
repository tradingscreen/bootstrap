/**
 * The following features are still outstanding: animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html tooltips, and selector delegation.
 */
angular.module( 'ui.bootstrap.tooltip', [ 'ui.bootstrap.position', 'ui.bootstrap.bindHtml' ] )

/**
 * The $tooltip service creates tooltip- and popover-like directives as well as
 * houses global options for them.
 */
.provider( '$tooltip', function () {
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
	this.options = function( value ) {
		angular.extend( globalOptions, value );
	};

  /**
   * This allows you to extend the set of trigger mappings available. E.g.:
   *
   *   $tooltipProvider.setTriggers( 'openTrigger': 'closeTrigger' );
   */
  this.setTriggers = function setTriggers ( triggers ) {
    angular.extend( triggerMap, triggers );
  };

  /**
   * This is a helper function for translating camel-case to snake-case.
   */
  function snake_case(name){
    var regexp = /[A-Z]/g;
    var separator = '-';
    return name.replace(regexp, function(letter, pos) {
      return (pos ? separator : '') + letter.toLowerCase();
    });
  }

  /**
   * Returns the actual instance of the $tooltip service.
   * TODO support multiple triggers
   */
  this.$get = [ '$window', '$compile', '$timeout', '$parse', '$document', '$position', '$interpolate', function ( $window, $compile, $timeout, $parse, $document, $position, $interpolate ) {
    return function $tooltip ( type, prefix, defaultTriggerShow ) {
      var options = angular.extend( {}, defaultOptions, globalOptions );

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
      function getTriggers ( trigger ) {
        var show = trigger || options.trigger || defaultTriggerShow;
        var hide = triggerMap[show] || show;
        return {
          show: show,
          hide: hide
        };
      }

      var directiveName = snake_case( type );

      var template =
        '<div '+
          directiveName +'-popup '+
          '>'+
        '</div>';

      return {
        restrict: 'EA',
        controller: angular.noop,
        controllerAs: 'tooltipCtrl',
        scope: {
          title: '@' + prefix + 'Title'
        },
        compile: function (tElem, tAttrs) {
          var tooltipLinker = $compile( template );

          return function link ( scope, element, attrs, tooltipCtrl ) {
            var target;
            var tooltip, tooltipScope;
            var transitionTimeout;
            var popupTimeout;
            var appendToBody = angular.isDefined( options.appendToBody ) ? options.appendToBody : false;
            var triggers = getTriggers( undefined );
            var hasEnableExp = angular.isDefined(attrs[prefix+'Enable']);
            var tooltipWidthWatcher;
            var positionTarget;

            function setTarget(element) {
              target = element;
              if (appendToBody && element && element[0]) {
                var boundingClientRect = element[0].getBoundingClientRect();
                var props = {
                  offsetWidth: element.prop('offsetWidth'),
                  offsetHeight: element.prop('offsetHeight')
                };
                positionTarget = {
                  0: {
                    getBoundingClientRect: function () {
                      return boundingClientRect;
                    }
                  },
                  prop: function (prop) {
                    return props[prop];
                  }
                };
              }
              else {
                positionTarget = element;
              }
            }

            setTarget(element);

            function intersection(r1, r2) {
              if (r1.x1 < r2.x1) {
                r1.x1 = r2.x1;
              }
              if (r1.y1 < r2.y1) {
                r1.y1 = r2.y1;
              }
              if (r1.x2 > r2.x2) {
                r1.x2 = r2.x2;
              }
              if (r1.y2 > r2.y2) {
                r1.y2 = r2.y2;
              }
              r1.x2 -= r1.x1;
              r1.y2 -= r1.y1;
              return {
                x: r1.x1,
                y: r1.y1,
                width: r1.x2,
                height: r1.y2
              };
            }

            var positionTooltip = function () {
              tooltip.css( {top: 0, left: 0} );

              var possible = ['bottom', 'right', 'top', 'left'];
              var start = possible.indexOf(scope.preferredPlacement);
              if (start < 0) {
                start = 0;
              }

              var ttWidth = tooltip.prop('offsetWidth');
              var ttHeight = tooltip.prop('offsetHeight');

              var bodyPosition;
              if (appendToBody) {
                bodyPosition = $position.offset($document.find('body'));
              }

              var bestPlacement;
              var i = start;
              do {
                var ttPosition = $position.positionElements(positionTarget, tooltip, possible[i], appendToBody);
                if (!bodyPosition) {
                  bestPlacement = ttPosition;
                  scope.placement = possible[i];
                  break;
                }
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

                var area = rect.width * rect.height;
                if (rect.width === ttWidth && rect.height === ttHeight) {
                  bestPlacement = ttPosition;
                  scope.placement = possible[i];
                  break;
                }

                if (!bestPlacement || bestPlacement.area < area) {
                  bestPlacement = { area: area, top: ttPosition.top, left: ttPosition.left };
                  scope.placement = possible[i];
                }

                i = (i + 1) % possible.length;
              } while (i != start);


              bestPlacement.top += 'px';
              bestPlacement.left += 'px';

              // Now set the calculated positioning.
              tooltip.css( bestPlacement );
            };

            // Set up the correct scope
            tooltipCtrl.scope = scope.$parent;

            // By default, the tooltip is not open.
            // TODO add ability to start tooltip opened
            scope.isOpen = false;

            function toggleTooltipBind () {
              if ( ! scope.isOpen ) {
                showTooltipBind();
              } else {
                hideTooltipBind();
              }
            }

            // Show the tooltip with delay if specified, otherwise show it immediately
            function showTooltipBind() {
              if(hasEnableExp && !scope.$parent.$eval(attrs[prefix+'Enable'])) {
                return;
              }
              if ( scope.tt_popupDelay ) {
                // Do nothing if the tooltip was already scheduled to pop-up.
                // This happens if show is triggered multiple times before any hide is triggered.
                if (!popupTimeout) {
                  popupTimeout = $timeout( show, scope.tt_popupDelay, false );
                  popupTimeout.then(function(reposition){reposition();});
                }
              } else {
                show()();
              }
            }

            function hideTooltipBind () {
              scope.$apply(function () {
                hide();
              });
            }

            function widthWatcher() {
              function start() {
                // Reposition the tooltip if necessary when the size of the content changes
                return scope.$watch(function() {
                  return tooltip.prop('clientWidth');
                }, function (value, oldValue) {
                  // Resize tooltip to accommodate the content if its size has changed ignoring
                  // the initial (oldValue is undefined) and final (value is undefined) resize
                  if (oldValue > 0 && value > 0 && oldValue !== value) {
                    positionTooltip();
                  }
                });
              }

              return {
                stop: start()
              };
            }

            // Show the tooltip popup element.
            function show() {

              popupTimeout = null;

              // If there is a pending remove transition, we must cancel it, lest the
              // tooltip be mysteriously removed.
              if ( transitionTimeout ) {
                $timeout.cancel( transitionTimeout );
                transitionTimeout = null;
              }

              // Don't show empty tooltips.
              if ( ! scope.content || scope.isOpen ) {
                return angular.noop;
              }

              createTooltip();

              // Set the initial positioning.
              tooltip.css({ top: 0, left: 0, display: 'block' });

              // Now we add it to the DOM because need some info about it. But it's not 
              // visible yet anyway.
              if ( appendToBody ) {
                  $document.find( 'body' ).append( tooltip );
              } else {
                target.after( tooltip );
              }

              // And show the tooltip.
              scope.isOpen = true;
              scope.$digest(); // digest required as $apply is not called

              positionTooltip();

              tooltipWidthWatcher = widthWatcher();

              // Return positioning function as promise callback for correct
              // positioning after draw.
              return positionTooltip;
            }

            // Hide the tooltip popup element.
            function hide() {

              //if tooltip is going to be shown after delay, we must cancel this
              $timeout.cancel( popupTimeout );
              popupTimeout = null;

              // Don't show already shown or empty tooltips.
              if ( !scope.isOpen ) {
                 return;
              }

              tooltipWidthWatcher.stop();

              // First things first: we don't show it anymore.
              scope.isOpen = false;

              // And now we remove it from the DOM. However, if we have animation, we 
              // need to wait for it to expire beforehand.
              // FIXME: this is a placeholder for a port of the transitions library.
              if ( scope.animation ) {
                if (!transitionTimeout) {
                  transitionTimeout = $timeout(removeTooltip, 500);
                }
              } else {
                removeTooltip();
              }
            }

            function createTooltip() {
              // There can only be one tooltip element per directive shown at once.
              if (tooltip) {
                removeTooltip();
              }
              // Make sure to use a new child scope every time as watchers leak into scope.
              // If linked DOM is removed, watchers from that DOM isn't removed.
              // Store it for manual destruction later
              tooltipScope = scope.$new();
              tooltip = tooltipLinker(tooltipScope, function () {});

              // Get contents rendered into the tooltip
              // Apply is required in order to make it work with rendering templates
              scope.$apply();
            }

            function removeTooltip() {
              transitionTimeout = null;
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
              if (tooltipScope) {
                tooltipScope.$destroy();
                tooltip = null;
              }
            }

            /**
             * Observe the relevant attributes.
             */
            attrs.$observe( type, function ( val ) {
              scope.content = val;

              if (!val && scope.isOpen ) {
                hide();
              }
            });

            attrs.$observe( prefix+'Placement', function ( val ) {
              scope.placement = angular.isDefined( val ) ? val : options.placement;
              scope.preferredPlacement = scope.placement;
            });

            attrs.$observe( prefix+'PopupDelay', function ( val ) {
              var delay = parseInt( val, 10 );
              scope.tt_popupDelay = ! isNaN(delay) ? delay : options.popupDelay;
            });

            var unregisterTriggers = function () {
              if (target) {
                target.unbind(triggers.show, showTooltipBind);
                target.unbind(triggers.hide, hideTooltipBind);
              }
            };

            attrs.$observe( prefix+'Trigger', function ( val ) {
              unregisterTriggers();

              if (val != 'manual') {
                triggers = getTriggers( val );

                if ( triggers.show === triggers.hide ) {
                  target.bind( triggers.show, toggleTooltipBind );
                } else {
                  target.bind( triggers.show, showTooltipBind );
                  target.bind( triggers.hide, hideTooltipBind );
                }
              }
            });

            if (attrs[prefix + 'Visible']) {
              scope.$parent.$watch(attrs[prefix + 'Visible'], function (val) {
                if (val) {
                  $timeout(show);
                }
                else {
                  $timeout(hide);
                }
              });
            }

            if (attrs[prefix + 'Target']) {
              scope.$parent.$watch(attrs[prefix + 'Target'], function (val) {
                  if (scope.isOpen && target !== val) {
                    if (target) {
                      $timeout(hide);
                    }
                    setTarget(val);
                    if (val) {
                      $timeout(show);
                    }
                  } else {
                    setTarget(val);
                  }
                });
              }

            var animation = scope.$eval(attrs[prefix + 'Animation']);
            scope.animation = angular.isDefined(animation) ? !!animation : options.animation;

            attrs.$observe( prefix+'AppendToBody', function ( val ) {
              appendToBody = angular.isDefined( val ) ? $parse( val )( scope ) : appendToBody;
            });

            // if a tooltip is attached to <body> we need to remove it on
            // location change as its parent scope will probably not be destroyed
            // by the change.
            if ( appendToBody ) {
              scope.$on('$locationChangeSuccess', function closeTooltipOnLocationChangeSuccess () {
              if ( scope.isOpen ) {
                hide();
              }
            });
            }

            // Make sure tooltip is destroyed and removed.
            scope.$on('$destroy', function onDestroyTooltip() {
              $timeout.cancel( transitionTimeout );
              $timeout.cancel( popupTimeout );
              unregisterTriggers();
              removeTooltip();
            });
          };
        }
      };
    };
  }];
})

.directive( 'tooltipTemplateTransclude', [
         '$http', '$compile', '$templateCache',
function ($http ,  $compile ,  $templateCache) {
  return {
    link: function ( scope, elem, attrs ) {
      if (scope.tooltipCtrl && scope.content) {
        // TODO: How to solve the problem of pre-loading the template?
        // TODO: Should this be watching for changes in scope.content?
        var templateUrl = scope.content,
            transcludeScope = scope.tooltipCtrl.scope.$new();
        $http.get( templateUrl, { cache: $templateCache })
        .then(function (response) {
          elem.html(response.data);
          $compile(elem.contents())(transcludeScope);
        });

        // Manual destruction because the transclude isn't a descendent of the
        // current scope
        scope.$on('$destroy', function () {
          transcludeScope.$destroy();
        });
      }
    }
  };
}])

.directive( 'tooltipPopup', function () {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/tooltip/tooltip-popup.html'
  };
})

.directive( 'tooltip', [ '$tooltip', function ( $tooltip ) {
  return $tooltip( 'tooltip', 'tooltip', 'mouseenter' );
}])

.directive( 'tooltipHtmlUnsafePopup', function () {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/tooltip/tooltip-html-unsafe-popup.html'
  };
})

.directive( 'tooltipHtmlUnsafe', [ '$tooltip', function ( $tooltip ) {
  return $tooltip( 'tooltipHtmlUnsafe', 'tooltip', 'mouseenter' );
}]);
