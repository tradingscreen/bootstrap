/**
 * The following features are still outstanding: popup delay, animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html popovers, and selector delegatation.
 */
angular.module('ui.bootstrap.popover', [ 'ui.bootstrap.tooltip' ])
    .directive('popoverPopup', function () {
        return {
            restrict: 'EA',
            replace: true,
            scope: { title: '@', content: '@', placement: '@', animation: '&', isOpen: '&' },
            templateUrl: 'template/popover/popover.html'
        };
    })
    .directive('popover', [ '$compile', '$timeout', '$parse', '$window', '$tooltip', function ($compile, $timeout, $parse, $window, $tooltip) {
        return $tooltip('popover', 'popover', 'click');
    }])
    .directive('popoverTemplatePopup', [ '$http', '$templateCache', '$compile', function ($http, $templateCache, $compile) {
        return {
            restrict: 'EA',
            replace: true,
            scope: { title: '@', content: '@', placement: '@', animation: '&', isOpen: '&', compileScope: '&' },
            templateUrl: 'template/popover/popover-template.html',
            link: function (scope, iElement) {
                scope.$watch('content', function (templateUrl) {
                    if (!templateUrl) {
                        return;
                    }
                    $http.get(templateUrl, { cache: $templateCache })
                        .then(function (response) {
                            var contentEl = angular.element(iElement[0].querySelector('.popover-content'));
                            contentEl.children().remove();
                            contentEl.append($compile(response.data.trim())(scope.compileScope()));
                        });
                });
            }
        };
    }])
    .directive('popoverTemplate', [ '$tooltip', function ($tooltip) {
        return $tooltip('popoverTemplate', 'popover', 'click');
    }]);
