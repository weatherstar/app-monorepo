import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { enabledAccountDynamicNetworkIds } from '@onekeyhq/engine/src/constants';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
  useStatus,
} from '@onekeyhq/kit/src/hooks/redux';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import {
  setGuideToPushFistTime,
  setHomeTabName,
} from '../../store/reducers/status';
import OfflineView from '../Offline';
import { PushNotificationRoutes } from '../PushNotification/types';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
import BackupToast from './BackupToast';
import NFTList from './NFT/NFTList';
import { WalletHomeTabEnum } from './type';

const WalletTabs: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { screenWidth } = useUserDevice();
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const { guideToPushFirstTime } = useStatus();
  const { pushNotification } = useSettings();
  const { dispatch } = backgroundApiProxy;
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const isVerticalLayout = useIsVerticalLayout();
  const { wallet, account, network } = useActiveWalletAccount();
  const [backupMap, updateBackMap] = useState<
    Record<string, boolean | undefined>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const backupToast = useCallback(() => {
    if (wallet && !wallet?.backuped && backupMap[wallet?.id] === undefined) {
      return (
        <BackupToast
          walletId={wallet.id}
          onClose={() => {
            updateBackMap((prev) => {
              prev[wallet?.id] = false;
              return { ...prev };
            });
          }}
        />
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.id, wallet?.backuped]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    if (!account?.id) {
      return;
    }
    const { pushEnable } = pushNotification || {};
    if (pushEnable) {
      return;
    }
    if (guideToPushFirstTime) {
      return;
    }
    if (!enabledAccountDynamicNetworkIds.includes(network?.id || '')) {
      return;
    }
    if (!guideToPushFirstTime) {
      dispatch(setGuideToPushFistTime(true));
    }
    setTimeout(() => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.PushNotification,
        params: {
          screen: PushNotificationRoutes.GuideToPushFirstTime,
        },
      });
    }, 3000);
  }, [
    pushNotification,
    account,
    network,
    dispatch,
    navigation,
    guideToPushFirstTime,
  ]);

  return (
    <>
      <Tabs.Container
        initialTabName={homeTabName}
        // @ts-ignore fix type when remove react-native-collapsible-tab-view
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          if (account?.id && network?.id) {
            backgroundApiProxy.engine.clearPriceCache();
            try {
              await backgroundApiProxy.serviceToken.fetchAccountTokens({
                activeAccountId: account.id,
                activeNetworkId: network.id,
                withBalance: true,
                withPrice: true,
                wait: true,
                forceReloadTokens: true,
              });
            } catch (e) {
              debugLogger.common.error(e);
            }
          }
          setTimeout(() => setRefreshing(false), 10);
        }}
        onTabChange={({ tabName }) => {
          backgroundApiProxy.dispatch(setHomeTabName(tabName));
        }}
        renderHeader={() => <AccountInfo />}
        width={isVerticalLayout ? screenWidth : screenWidth - 224} // reduce the width on iPad, sidebar's width is 244
        pagerProps={{ scrollEnabled: false }}
        headerHeight={
          isVerticalLayout
            ? FIXED_VERTICAL_HEADER_HEIGHT
            : FIXED_HORIZONTAL_HEDER_HEIGHT
        }
        containerStyle={{
          maxWidth: MAX_PAGE_CONTAINER_WIDTH,
          width: '100%',
          marginHorizontal: 'auto', // Center align vertically
          backgroundColor: tabbarBgColor,
          alignSelf: 'center',
          flex: 1,
        }}
        headerContainerStyle={{
          shadowOffset: { width: 0, height: 0 },
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: borderDefault,
        }}
      >
        <Tabs.Tab
          name={WalletHomeTabEnum.Tokens}
          label={intl.formatMessage({ id: 'asset__tokens' })}
        >
          <AssetsList ListFooterComponent={<Box h={16} />} limitSize={20} />
        </Tabs.Tab>
        <Tabs.Tab
          name={WalletHomeTabEnum.Collectibles}
          label={intl.formatMessage({ id: 'asset__collectibles' })}
        >
          <NFTList />
        </Tabs.Tab>
        <Tabs.Tab
          name={WalletHomeTabEnum.History}
          label={intl.formatMessage({ id: 'transaction__history' })}
        >
          {/* {platformEnv.isLegacyHistory ? (
            <HistoricalRecord
              accountId={account?.id}
              networkId={network?.id}
              isTab
            />
          ) : ( */}
          <TxHistoryListView
            accountId={account?.id}
            networkId={network?.id}
            isHomeTab
          />
          {/* )} */}
        </Tabs.Tab>
      </Tabs.Container>
      {backupToast()}
    </>
  );
};

export default function Wallet() {
  return (
    <>
      <IdentityAssertion>
        <WalletTabs />
      </IdentityAssertion>
      <OfflineView />
    </>
  );
}
