/** @format */

/**
 * Internal dependencies
 */
import { combineReducers, createReducer, keyedReducer } from 'state/utils';
import {
	GOOGLE_MY_BUSINESS_CONNECT_LOCATION,
	GOOGLE_MY_BUSINESS_STATS_CHANGE_INTERVAL,
} from 'state/action-types';

const location = createReducer(
	{ id: null },
	{
		[ GOOGLE_MY_BUSINESS_CONNECT_LOCATION ]: ( state, { locationId } ) => ( {
			id: locationId,
		} ),
	}
);

const statInterval = createReducer( 'week', {
	[ GOOGLE_MY_BUSINESS_STATS_CHANGE_INTERVAL ]: ( state, { interval } ) => interval,
} );

export default keyedReducer(
	'siteId',
	combineReducers( { location, statInterval: keyedReducer( 'statType', statInterval ) } )
);
