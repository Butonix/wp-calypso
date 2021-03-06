/** @format */
/**
 * External dependencies
 */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { localize } from 'i18n-calypso';
import { get } from 'lodash';
import classNames from 'classnames';
import { connect } from 'react-redux';

/**
 * Internal dependencies
 */
import PlanFeatures from 'my-sites/plan-features';
import {
	TYPE_FREE,
	TYPE_PERSONAL,
	TYPE_PREMIUM,
	TYPE_BUSINESS,
	TERM_MONTHLY,
	TERM_ANNUALLY,
	TERM_BIENNIALLY,
	GROUP_WPCOM,
	GROUP_JETPACK,
} from 'lib/plans/constants';
import { addQueryArgs } from 'lib/url';
import QueryPlans from 'components/data/query-plans';
import QuerySitePlans from 'components/data/query-site-plans';
import FAQ from 'components/faq';
import FAQItem from 'components/faq/faq-item';
import { isEnabled } from 'config';
import { purchasesRoot } from 'me/purchases/paths';
import { plansLink, findPlansKeys, getPlan } from 'lib/plans';
import SegmentedControl from 'components/segmented-control';
import SegmentedControlItem from 'components/segmented-control/item';
import PaymentMethods from 'blocks/payment-methods';
import HappychatButton from 'components/happychat/button';
import HappychatConnection from 'components/happychat/connection-connected';
import isHappychatAvailable from 'state/happychat/selectors/is-happychat-available';
import { selectSiteId as selectHappychatSiteId } from 'state/help/actions';

export class PlansFeaturesMain extends Component {
	componentWillUpdate( nextProps ) {
		/**
		 * Happychat does not update with the selected site right now :(
		 * This ensures that Happychat groups are correct in case we switch sites while on the plans
		 * page, for example between a Jetpack and Simple site.
		 *
		 * @TODO: When happychat correctly handles site switching, remove selectHappychatSiteId action.
		 */
		const siteId = get( this.props, [ 'site', 'ID' ] );
		const nextSiteId = get( nextProps, [ 'site', 'ID' ] );
		if ( siteId !== nextSiteId && nextSiteId ) {
			this.props.selectHappychatSiteId( nextSiteId );
		}
	}

	getPlanFeatures() {
		const {
			basePlansPath,
			displayJetpackPlans,
			domainName,
			isInSignup,
			isLandingPage,
			onUpgradeClick,
			selectedFeature,
			selectedPlan,
			site,
		} = this.props;

		return (
			<div
				className="plans-features-main__group"
				data-e2e-plans={ displayJetpackPlans ? 'jetpack' : 'wpcom' }
			>
				<PlanFeatures
					basePlansPath={ basePlansPath }
					displayJetpackPlans={ displayJetpackPlans }
					domainName={ domainName }
					isInSignup={ isInSignup }
					isLandingPage={ isLandingPage }
					onUpgradeClick={ onUpgradeClick }
					plans={ this.getPlansForPlanFeatures() }
					selectedFeature={ selectedFeature }
					selectedPlan={ selectedPlan }
					site={ site }
				/>
			</div>
		);
	}

	getPlansForPlanFeatures() {
		const { displayJetpackPlans, intervalType, selectedPlan, hideFreePlan } = this.props;

		const currentPlan = getPlan( selectedPlan );

		let term;
		if ( intervalType === 'monthly' ) {
			term = TERM_MONTHLY;
		} else if ( intervalType === 'yearly' ) {
			term = TERM_ANNUALLY;
		} else if ( intervalType === '2yearly' ) {
			term = TERM_BIENNIALLY;
		} else if ( currentPlan ) {
			term = currentPlan.term;
		} else {
			term = TERM_ANNUALLY;
		}

		const group = displayJetpackPlans ? GROUP_JETPACK : GROUP_WPCOM;
		const personalPlan = findPlansKeys( { group, term, type: TYPE_PERSONAL } )[ 0 ];
		const plans = [
			findPlansKeys( { group, type: TYPE_FREE } )[ 0 ],
			personalPlan,
			findPlansKeys( { group, term, type: TYPE_PREMIUM } )[ 0 ],
			findPlansKeys( { group, term, type: TYPE_BUSINESS } )[ 0 ],
		];

		if ( hideFreePlan ) {
			plans.shift();
		}

		if ( ! isEnabled( 'plans/personal-plan' ) && ! displayJetpackPlans ) {
			plans.splice( plans.indexOf( personalPlan ), 1 );
		}

		return plans;
	}

	getJetpackFAQ() {
		const { isChatAvailable, translate } = this.props;

		const helpLink =
			isEnabled( 'jetpack/happychat' ) && isChatAvailable ? (
				<HappychatButton className="plans-features-main__happychat-button" />
			) : (
				<a href="https://jetpack.com/contact-support/" target="_blank" rel="noopener noreferrer" />
			);

		return (
			<FAQ>
				<FAQItem
					question={ translate( 'I signed up and paid. What’s next?' ) }
					answer={ translate(
						'Our premium features are powered by a few of our other plugins. After purchasing you will' +
							' need to install the Akismet and VaultPress plugins. Just follow the guide' +
							' after you complete your purchase.'
					) }
				/>

				<FAQItem
					question={ translate( 'What are the hosting requirements?' ) }
					answer={ translate(
						'You should be running the latest version of WordPress and be using a web host that runs' +
							' PHP 5 or higher. You will also need a WordPress.com account (you can register' +
							' during the connection process) and a publicly-accessible site with XML-RPC enabled.'
					) }
				/>

				<FAQItem
					question={ translate( 'Does this work with a multisite network?' ) }
					answer={ translate(
						'Yes, Jetpack and all of its premium features are compatible with WordPress Multisite' +
							' networks. If you manage a Multisite network you will need to make sure you have a' +
							' subscription for each site you wish to cover with premium features.'
					) }
				/>

				<FAQItem
					question={ translate( 'Why do I need a WordPress.com account?' ) }
					answer={ translate(
						"Many of Jetpack's core features make use of the WordPress.com cloud. In order to make sure" +
							' everything works correctly, Jetpack requires you to connect a (free) WordPress.com' +
							" account. If you don't already have an account you can easily create one during the" +
							' connection process.'
					) }
				/>

				<FAQItem
					question={ translate( 'What is the cancellation policy?' ) }
					answer={ translate(
						'You can request a cancellation within 30 days of purchase and receive a full refund.'
					) }
				/>

				<FAQItem
					question={ translate( 'Have more questions?' ) }
					answer={ translate(
						'No problem! Feel free to {{helpLink}}get in touch{{/helpLink}} with our Happiness Engineers.',
						{
							components: { helpLink },
						}
					) }
				/>
			</FAQ>
		);
	}

	getFAQ() {
		const { isChatAvailable, site, translate } = this.props;

		const helpLink =
			isEnabled( 'happychat' ) && isChatAvailable ? (
				<HappychatButton className="plans-features-main__happychat-button" />
			) : (
				<a href="https://wordpress.com/help" target="_blank" rel="noopener noreferrer" />
			);

		return (
			<FAQ>
				<FAQItem
					question={ translate( 'Do you sell domains?' ) }
					answer={ translate(
						'Yes! The Personal, Premium, and Business plans include a free custom domain. That includes new' +
							' domains purchased through WordPress.com or your own existing domain that you can map' +
							' to your WordPress.com site. Does not apply to premium domains. {{a}}Find out more about domains.{{/a}}',
						{
							components: {
								a: (
									<a
										href="https://en.support.wordpress.com/all-about-domains/"
										target="_blank"
										rel="noopener noreferrer"
									/>
								),
							},
						}
					) }
				/>

				<FAQItem
					question={ translate( 'Can I install plugins?' ) }
					answer={ translate(
						'Yes! With the WordPress.com Business plan you can search for and install external plugins.' +
							' All plans already come with a custom set of plugins tailored just for them.' +
							' {{a}}Check out all included plugins{{/a}}.',
						{
							components: { a: <a href={ `/plugins/${ site.slug }` } /> },
						}
					) }
				/>

				<FAQItem
					question={ translate( 'Can I upload my own theme?' ) }
					answer={ translate(
						"Yes! With the WordPress.com Business plan you can upload any theme you'd like." +
							' All plans give you access to our {{a}}directory of free and premium themes{{/a}}.' +
							' These are among the highest-quality WordPress themes, hand-picked and reviewed by our team.',
						{
							components: { a: <a href={ `/themes/${ site.slug }` } /> },
						}
					) }
				/>

				<FAQItem
					question={ translate( 'Do I need another web host?' ) }
					answer={ translate(
						'No. All WordPress.com sites include our specially tailored WordPress hosting to ensure' +
							' your site stays available and secure at all times. You can even use your own domain' +
							' when you upgrade to the Personal, Premium, or Business plan.'
					) }
				/>

				<FAQItem
					question={ translate( 'Do you offer email accounts?' ) }
					answer={ translate(
						'Yes. If you register a new domain with our Personal, Premium, or Business plans, you can' +
							' add Google-powered G Suite. You can also set up email forwarding for any custom domain' +
							' registered through WordPress.com. {{a}}Find out more about email{{/a}}.',
						{
							components: {
								a: (
									<a
										href="https://en.support.wordpress.com/add-email/"
										target="_blank"
										rel="noopener noreferrer"
									/>
								),
							},
						}
					) }
				/>

				<FAQItem
					question={ translate( 'What’s included with advanced custom design?' ) }
					answer={ translate(
						'Custom design is a toolset you can use to personalize your blog’s look and feel with' +
							' custom colors & backgrounds, custom fonts, and even a CSS editor that you can use for' +
							' more precise control of your site’s' +
							' design. {{a}}Find out more about custom design{{/a}}.',
						{
							components: {
								a: (
									<a
										href="https://en.support.wordpress.com/custom-design/"
										target="_blank"
										rel="noopener noreferrer"
									/>
								),
							},
						}
					) }
				/>

				<FAQItem
					question={ translate( 'Will upgrading affect my content?' ) }
					answer={ translate(
						'Plans add extra features to your site, but they do not affect the content of your site' +
							" or your site's followers."
					) }
				/>

				<FAQItem
					question={ translate( 'Can I cancel my subscription?' ) }
					answer={ translate(
						'Yes. We want you to love everything you do at WordPress.com, so we provide a 30-day' +
							' refund on all of our plans. {{a}}Manage purchases{{/a}}.',
						{
							components: { a: <a href={ purchasesRoot } /> },
						}
					) }
				/>

				<FAQItem
					question={ translate( 'Have more questions?' ) }
					answer={ translate(
						'Need help deciding which plan works for you? Our happiness engineers are available for' +
							' any questions you may have. {{helpLink}}Get help{{/helpLink}}.',
						{
							components: { helpLink },
						}
					) }
				/>
			</FAQ>
		);
	}

	constructPath( plansUrl, intervalType ) {
		const { selectedFeature, selectedPlan, site } = this.props;
		return addQueryArgs(
			{
				feature: selectedFeature,
				plan: selectedPlan,
			},
			plansLink( plansUrl, site, intervalType )
		);
	}

	getIntervalTypeToggle() {
		const { basePlansPath, intervalType, translate } = this.props;
		const segmentClasses = classNames( 'plan-features__interval-type', 'price-toggle' );

		let plansUrl = '/plans';

		if ( basePlansPath ) {
			plansUrl = basePlansPath;
		}

		return (
			<SegmentedControl compact className={ segmentClasses } primary={ true }>
				<SegmentedControlItem
					selected={ intervalType === 'monthly' }
					path={ this.constructPath( plansUrl, 'monthly' ) }
				>
					{ translate( 'Monthly billing' ) }
				</SegmentedControlItem>

				<SegmentedControlItem
					selected={ intervalType === 'yearly' }
					path={ this.constructPath( plansUrl, 'yearly' ) }
				>
					{ translate( 'Yearly billing' ) }
				</SegmentedControlItem>
			</SegmentedControl>
		);
	}

	render() {
		const { site, displayJetpackPlans, isInSignup } = this.props;

		const renderFAQ = () => ( displayJetpackPlans ? this.getJetpackFAQ() : this.getFAQ( site ) );
		let faqs = null;

		if ( ! isInSignup ) {
			faqs = renderFAQ();
		}

		return (
			<div className="plans-features-main">
				<HappychatConnection />
				<div className="plans-features-main__notice" />
				{ displayJetpackPlans ? this.getIntervalTypeToggle() : null }
				<QueryPlans />
				<QuerySitePlans siteId={ get( site, 'ID' ) } />
				{ this.getPlanFeatures() }
				<PaymentMethods />
				{ faqs }
				<div className="plans-features-main__bottom" />
			</div>
		);
	}
}

PlansFeaturesMain.propTypes = {
	basePlansPath: PropTypes.string,
	displayJetpackPlans: PropTypes.bool.isRequired,
	hideFreePlan: PropTypes.bool,
	intervalType: PropTypes.string,
	isChatAvailable: PropTypes.bool,
	isInSignup: PropTypes.bool,
	isLandingPage: PropTypes.bool,
	onUpgradeClick: PropTypes.func,
	selectedFeature: PropTypes.string,
	selectedPlan: PropTypes.string,
	showFAQ: PropTypes.bool,
	site: PropTypes.object,
};

PlansFeaturesMain.defaultProps = {
	basePlansPath: null,
	hideFreePlan: false,
	intervalType: 'yearly',
	isChatAvailable: false,
	showFAQ: true,
	site: {},
};

export default connect(
	state => ( {
		isChatAvailable: isHappychatAvailable( state ),
	} ),
	{ selectHappychatSiteId }
)( localize( PlansFeaturesMain ) );
