import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, Tabs, TabList, Tab, TabPanels, TabPanel, useColorModeValue
} from '@chakra-ui/react';
import { Calculator, History, Settings2 } from 'lucide-react';
import { BillingExecutePanel } from './BillingDistribution';
import { BillingHistoryPanel } from './BillingHistory';
import { BillingRulesPanel } from './BillingRules';

const TAB_PATHS = ['/billing', '/billing/history', '/billing/rules'];

const tabFromPath = (pathname) => {
  if (pathname.includes('/history')) return 1;
  if (pathname.includes('/rules')) return 2;
  return 0;
};

export default function Billing() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(() => tabFromPath(location.pathname));
  const [highlightRunId, setHighlightRunId] = useState(null);
  const [prefillPayrollId, setPrefillPayrollId] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const tabBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.6)');

  useEffect(() => {
    setTabIndex(tabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (index) => {
    setTabIndex(index);
    navigate(TAB_PATHS[index]);
    if (index !== 1) setHighlightRunId(null);
  };

  const handleConfirmed = useCallback((run) => {
    setHistoryRefreshKey((k) => k + 1);
    if (run?.id) setHighlightRunId(run.id);
    navigate('/billing/history');
  }, [navigate]);

  const handleViewPayroll = useCallback((payrollId) => {
    setPrefillPayrollId(payrollId);
    navigate('/billing');
  }, [navigate]);

  const tabs = [
    { label: 'Ejecutar', icon: Calculator },
    { label: 'Historial', icon: History },
    { label: 'Reglas', icon: Settings2 }
  ];

  return (
    <Box p={6}>
      <Box mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Facturación</Text>
        <Text color="gray.500" mt={1}>
          Mensual por empresa (2ª) · Proquima, Unhesa, Econacional · por centro de costo
        </Text>
      </Box>

      <Tabs
        index={tabIndex}
        onChange={handleTabChange}
        colorScheme="brand"
        variant="enclosed"
        isLazy
      >
        <TabList
          borderColor={borderColor}
          bg={tabBg}
          borderRadius="xl"
          p={1}
          gap={1}
          flexWrap="wrap"
        >
          {tabs.map((t) => (
            <Tab
              key={t.label}
              fontWeight={600}
              borderRadius="lg"
              _selected={{ bg: 'brand.500', color: 'white', shadow: 'sm' }}
            >
              <Flex align="center" gap={2}>
                <t.icon size={16} />
                {t.label}
              </Flex>
            </Tab>
          ))}
        </TabList>

        <TabPanels mt={6}>
          <TabPanel px={0}>
            <BillingExecutePanel
              prefillPayrollId={prefillPayrollId}
              onPrefillConsumed={() => setPrefillPayrollId('')}
              onConfirmed={handleConfirmed}
              onGoToRules={() => handleTabChange(2)}
            />
          </TabPanel>
          <TabPanel px={0}>
            <BillingHistoryPanel
              refreshKey={historyRefreshKey}
              highlightRunId={highlightRunId}
              onViewPayroll={handleViewPayroll}
            />
          </TabPanel>
          <TabPanel px={0}>
            <BillingRulesPanel />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
