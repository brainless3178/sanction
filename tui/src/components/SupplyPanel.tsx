import React from 'react';
import { Box, Text } from 'ink';
import { SupplyData } from '../hooks/useSupply';

interface SupplyPanelProps {
    supply: SupplyData;
}

export const SupplyPanel: React.FC<SupplyPanelProps> = ({ supply }) => {
    return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} width={22}>
            <Text bold color="cyan">SUPPLY</Text>
            <Box marginTop={1} flexDirection="column">
                <Text>Circulating:</Text>
                <Text bold color="green">{formatAmount(supply.circulating)}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
                <Text dimColor>Minted: {formatAmount(supply.totalMinted)}</Text>
                <Text dimColor>Burned: {formatAmount(supply.totalBurned)}</Text>
            </Box>
        </Box>
    );
};

function formatAmount(amount: string): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
}
