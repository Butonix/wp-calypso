/** @format */
/**
 * External dependencies
 */
import { get, merge, omitBy } from 'lodash';
import { translate } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import fromApi from './from-api';
// eslint-disable-next-line no-unused-vars
import { ACTIVITY_LOG_REQUEST, ACTIVITY_LOG_WATCH } from 'state/action-types';
import { activityLogRequest, activityLogUpdate } from 'state/activity-log/actions';
import { dispatchRequestEx, getData, getError } from 'state/data-layer/wpcom-http/utils';
import { http } from 'state/data-layer/wpcom-http/actions';
import { errorNotice } from 'state/notices/actions';
import { recordTracksEvent } from 'state/analytics/actions';

const POLL_INTERVAL = 8000;
const pollingSites = new Map();

/**
 * Registers a site to start polling for new events from the Activity Log
 *
 * When we view the Activity Log we want to see any new events that appear
 * since the time we started viewing it. This function can be called on
 * component mount and unmount in order to register that particular site
 * for the updates.
 *
 * We start the update process by requesting activity log events which
 * have appeared since we started viewing the Activity Log. That triggers
 * a loop based on the `isWatching` action meta which continues until
 * we have de-registered the site here.
 *
 * @param {function} dispatch Redux dispatcher
 * @param {function} getState Redux getState
 * @param {boolean} isWatching whether to start/continue polling for updates
 * @param {number} siteId site to watch
 */
export const togglePolling = ( { dispatch, getState }, { isWatching, siteId } ) => {
	if ( ! isWatching ) {
		pollingSites.delete( siteId );
		return;
	}

	pollingSites.set( siteId, {} );

	// kick off the first polling
	//
	// we start by grabbing one event - this is a result of the way
	// that the backend is currently sending events with truncated
	// timestamps. we end up always getting the latest event in the
	// response. therefore, by setting a number of one we'll get that
	// event initially and it will return a `nextAfter` value which
	// we'll subsequently use to poll with a higher `number` value
	dispatch(
		merge(
			activityLogRequest( siteId, {
				dateStart: Date.now(),
				number: 1,
				sortOrder: 'asc',
			} ),
			{ meta: { dataLayer: { isWatching: true } } }
		)
	);
};

/**
 * Determines whether to continue polling for new Activity Log events
 * and issues the polling requests if it should.
 *
 * We should continue polling if:
 * 	- The incoming action is a polling action (isWatching meta)
 * 	- We are still watching the site (internal data-layer state)
 *  - The last update was successful
 *  - We're not already waiting on a poll to come back
 *
 * We determine the position into the index based off of the
 * `nextAfter` property in the response from the API call.
 * This property is given by ElasticSearch and is independent
 * of the type of data; it's generated by the sort order of the
 * initial query and is a stateless way of continuing a cursor.
 *
 * Should we have no `nextAfter` in the response (which occurs
 * when there are no updates to be had) then we fall back to the
 * most-recent `nextAfter` value or the current time if even
 * that fails.
 *
 * @param {function} dispatch Redux dispatcher
 * @param {object} action incoming action
 */
export const continuePolling = ( { dispatch, getState }, action ) => {
	// ignore any updates which weren't triggered by the polling system
	if ( ! get( action, 'meta.dataLayer.isWatching' ) ) {
		return;
	}

	const { siteId } = action;

	const error = getError( action );
	if ( undefined !== error ) {
		pollingSites.delete( siteId );

		dispatch( recordTracksEvent( 'calypso_activity_log_polling_fail', { site_id: siteId } ) );
		return;
	}

	const rawData = getData( action );
	if ( undefined !== rawData ) {
		const prevState = pollingSites.get( siteId );

		// no need to send out a new request if we're waiting on one
		if ( prevState.timer ) {
			return;
		}

		const { nextAfter } = rawData;

		const timer = setTimeout( () => {
			const thisState = pollingSites.get( siteId );

			// Since we update the list of sites with pollingSites.set()
			// We need to check to make sure that the site was not removed.
			// Otherwise this causes a bug where we poll the site forever.
			if ( ! thisState ) {
				return;
			}

			pollingSites.set( siteId, { ...thisState, timer: null } );

			const meta = { meta: { dataLayer: { isWatching: true } } };
			const searchAfter = nextAfter || thisState.nextAfter;
			const number = nextAfter ? 100 : 1; // if we didn't get a new `nextAfter` then force one through the limit
			const sortOrder = 'asc';

			if ( searchAfter ) {
				dispatch( merge( activityLogRequest( siteId, { searchAfter, number, sortOrder } ), meta ) );
				return;
			}

			// if we have no sort order after which to search
			// then we resort to the previous timestamp
			const { dateStart } = action.params;
			dispatch( merge( activityLogRequest( siteId, { dateStart, number, sortOrder } ), meta ) );
		}, POLL_INTERVAL );

		pollingSites.set( siteId, {
			...prevState,
			nextAfter: nextAfter || prevState.nextAfter,
			timer,
		} );
	}
};

export const handleActivityLogRequest = action => {
	const { params = {}, siteId } = action;

	return http(
		{
			apiNamespace: 'wpcom/v2',
			method: 'GET',
			path: `/sites/${ siteId }/activity`,
			query: omitBy(
				{
					action: params.action,
					date_end: params.date_end || params.dateEnd,
					date_start: params.date_start || params.dateStart,
					group: params.group,
					name: params.name,
					number: params.number,
					search_after: JSON.stringify( params.searchAfter ),
					sort_order: params.sortOrder,
				},
				a => a === undefined
			),
		},
		action
	);
};

export const receiveActivityLog = ( action, data ) => {
	const stateUpdate = activityLogUpdate(
		action.siteId,
		data.items.filter( i => i.hasOwnProperty( 'rewindId' ) ),
		data.totalItems,
		data.oldestItemTs,
		action.params,
		{ doMerge: action.params.hasOwnProperty( 'searchAfter' ) }
	);

	// if we have no further pages to fetch (nothing more to do)
	// or if we are receiving a polling action (polling will handle next action)
	// then let it be and inject into state
	if ( ! data.hasOwnProperty( 'nextAfter' ) || get( action, 'meta.dataLayer.isWatching' ) ) {
		return stateUpdate;
	}

	return [
		activityLogRequest(
			action.siteId,
			merge( {}, action.params, { searchAfter: data.nextAfter } )
		),
		stateUpdate,
	];
};

export const receiveActivityLogError = () =>
	errorNotice( translate( 'Error receiving activity for site.' ) );

export default {
	[ ACTIVITY_LOG_REQUEST ]: [
		dispatchRequestEx( {
			fetch: handleActivityLogRequest,
			onSuccess: receiveActivityLog,
			onError: receiveActivityLogError,
			fromApi,
		} ),
		// continuePolling,
	],
	// [ ACTIVITY_LOG_WATCH ]: [ togglePolling ],
};
