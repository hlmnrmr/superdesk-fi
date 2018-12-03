import { get } from 'lodash';
import moment from 'moment';
import CompliantLifetimeComponent from '../components/CompliantLifetime';
import VersionCreatedComponent from '../components/VersionCreated';
import { getStatus } from '../compliance-status';


ComplianceReviewCtrl.$inject = ['$location', 'moment', 'gettext', '$scope'];
export function ComplianceReviewCtrl($location, moment, gettext, $scope) {
    const SUPERDESK = 'local';

    $scope.numberOfItems = 0;
    const sortString = 'extra.compliantlifetime:asc';

    $location.search('sort', sortString);

    this.complianceFilters = {
        before_next_month: {
            days: 30,
            label: gettext('Next Month')
        },
        before_3_months_ahead: {
            days: 90,
            label: gettext('Next 3 Months')
        }
    };

    // helper fns

    const filterExists = (key) => this.complianceFilters.hasOwnProperty(key)
    const setFilterInUrl = (filter) => $location.search('deadline', filter);
    const getFilterFromUrl = () => $location.search().deadline;
    const defaultFilter = () => Object.keys(this.complianceFilters)[0];
    // old versions of corrected items can
    // have a date that doesn't match the filter
    const filterWrongLifetime = (items, filter) => {
        const range = this.complianceFilters[filter].days;
        const now = moment();
        return items.filter(({ archive_item }) => {
            const lifetime = moment(archive_item.extra.compliantlifetime);
            return lifetime.diff(now, 'days') < range;
        });
    };

    const unwantedStates = [ 'killed' ];
    const filterUnwatedStates = (items) =>
        items.filter(item => !unwantedStates.includes(item.state));
    const wantedItemTypes = [ 'text' ];
    const filterUnwatedTypes = (items) =>
        items.filter(item => wantedItemTypes.includes(item.type));

    // methods for view

    this.setFilter = (filter) => {
        if (filterExists(filter)) {
            this.activeFilter = filter;
            setFilterInUrl(filter);
        }
    };

    // methods for parent directive

    this.repo = {
        published: true,
        search: SUPERDESK,
    };

    if (filterExists(getFilterFromUrl())) {
        this.activeFilter = getFilterFromUrl();
    } else {
        this.setFilter(defaultFilter())
    }

    this.getSearch = () => {
        let deadline = getFilterFromUrl();

        if (!deadline || !filterExists(deadline)) {
            this.setFilter(defaultFilter());
            deadline = getFilterFromUrl();
        }

        this.labelTo = `${gettext('Need review before')} ${this.complianceFilters[this.activeFilter].label}`;

        return {
            repo: 'published',
            'extra.compliantlifetime': deadline,
        };
    };

    this.customRender = {
        fields: {
            compliantlifetime: CompliantLifetimeComponent,
            versioncreated: VersionCreatedComponent,
        },
        getItemClass: getStatus,
    };

    $scope.$watch('items', (items) => {
        if (items) {
            let {_items} = items
            _items = filterWrongLifetime(_items, getFilterFromUrl());
            _items = filterUnwatedStates(_items);
            _items = filterUnwatedTypes(_items);

            $scope.numberOfItems = _items.length;
            $scope.items._items = _items;
        }
    });
    $scope.$watch('view', () => $scope.view = 'compact') // force compact view
}

export default angular.module('fidelity.compliance-review', ['superdesk.apps.authoring.widgets'])
    .config(['gettext', 'superdeskProvider', 'workspaceMenuProvider', 'config', function(gettext, superdesk, workspaceMenuProvider, config) {
            if (get(config, 'features.complianceReview', false)) {
                superdesk.activity('/compliance-review', {
                    description: gettext('Review published content'),
                    label: gettext('Compliance review'),
                    templateUrl: 'compliance-review.html',
                    sideTemplateUrl: 'scripts/apps/workspace/views/workspace-sidenav.html',
                    controller: ComplianceReviewCtrl,
                    controllerAs: 'search',
                });

                workspaceMenuProvider.item({
                    icon: 'archive',
                    href: '/compliance-review',
                    label: gettext('Compliance review'),
                });
            }
        },
    ])

    .controller('ComplianceReviewCtrl', ComplianceReviewCtrl)

    .run(['$templateCache', ($templateCache) => {
        $templateCache.put('compliance-review.html',require('../views/compliance-review.html'));
    }]);