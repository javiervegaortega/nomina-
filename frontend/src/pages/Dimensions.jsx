import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, Tabs, TabList, Tab, TabPanels, TabPanel, useColorModeValue
} from '@chakra-ui/react';
import { Network, Map, Briefcase, Split, Hexagon } from 'lucide-react';
import { DepartmentsPanel } from './Departments';
import { AreasPanel } from './Areas';
import { DivisionsPanel } from './Divisions';
import { SubdivisionsPanel } from './Subdivisions';
import { Dimension5Panel } from './Dimension5';

const TAB_PATHS = [
  '/dimensions',
  '/dimensions/areas',
  '/dimensions/divisions',
  '/dimensions/subdivisions',
  '/dimensions/dimension5'
];

const tabFromPath = (pathname) => {
  if (pathname.includes('/dimension5')) return 4;
  if (pathname.includes('/subdivisions')) return 3;
  if (pathname.includes('/divisions')) return 2;
  if (pathname.includes('/areas')) return 1;
  if (pathname.includes('/departments')) return 0;
  return 0;
};

export default function Dimensions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(() => tabFromPath(location.pathname));

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const tabBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.6)');

  useEffect(() => {
    const index = tabFromPath(location.pathname);
    setTabIndex(index);
    const normalized = TAB_PATHS[index];
    if (location.pathname !== normalized) {
      navigate(normalized, { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleTabChange = (index) => {
    setTabIndex(index);
    navigate(TAB_PATHS[index]);
  };

  const tabs = [
    { label: 'Departamentos', icon: Network },
    { label: 'Áreas', icon: Map },
    { label: 'Divisiones', icon: Briefcase },
    { label: 'Subdivisiones', icon: Split },
    { label: 'Dimensión 5', icon: Hexagon }
  ];

  return (
    <Box p={6}>
      <Box mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Dimensiones</Text>
        <Text color="gray.500" mt={1}>
          Catálogo organizacional: departamentos, áreas, divisiones, subdivisiones y dimensión 5.
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
              fontSize="sm"
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
          <TabPanel px={0}><DepartmentsPanel /></TabPanel>
          <TabPanel px={0}><AreasPanel /></TabPanel>
          <TabPanel px={0}><DivisionsPanel /></TabPanel>
          <TabPanel px={0}><SubdivisionsPanel /></TabPanel>
          <TabPanel px={0}><Dimension5Panel /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
