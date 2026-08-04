import React from 'react';
import { Hexagon } from 'lucide-react';
import { Box, Flex, Heading, Text, Center, Image, useColorModeValue } from '@chakra-ui/react';

export default function AuthSidePanel() {
  const bgGradient = useColorModeValue(
    'linear(to-br, brand.600, brand.900)',
    'linear(to-br, gray.800, gray.900)'
  );

  return (
    <Flex
      h="100%"
      w="100%"
      bgGradient={bgGradient}
      color="white"
      align="center"
      justify="center"
      p={12}
      position="relative"
      overflow="hidden"
    >
      {/* Background decoration */}
      <Box
        position="absolute"
        top="-10%"
        left="-10%"
        w="400px"
        h="400px"
        bg="whiteAlpha.100"
        borderRadius="full"
        filter="blur(60px)"
      />
      <Box
        position="absolute"
        bottom="-10%"
        right="-10%"
        w="500px"
        h="500px"
        bg="brand.400"
        opacity="0.2"
        borderRadius="full"
        filter="blur(80px)"
      />

      <Box position="relative" zIndex={1} maxW="md">
        <Flex align="center" gap={5} mb={10}>
          <Image src={`${import.meta.env.BASE_URL}favicon.png`} boxSize="128px" objectFit="contain" borderRadius="2xl" shadow="lg" />
          <Text fontSize="4xl" fontWeight={800} letterSpacing="-0.03em" color="white">
            Nómina
          </Text>
        </Flex>
        
        <Heading as="h1" fontSize={{ base: '3xl', xl: '4xl' }} fontWeight={800} lineHeight={1.1} mb={6} letterSpacing="-0.02em" color="white">
          Gestión de nómina <br />
          <Text as="span" color="brand.200">sin complicaciones.</Text>
        </Heading>
        
        <Text fontSize="lg" color="whiteAlpha.800" lineHeight={1.6}>
          Automatiza pagos y obtén reportes financieros precisos en una sola plataforma.
        </Text>
      </Box>
    </Flex>
  );
}
