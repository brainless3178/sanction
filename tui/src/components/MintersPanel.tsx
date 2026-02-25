import React from 'react';
import { Box, Text } from 'ink';

interface Minter {
    address: string;
    quotaUsed: number; // percentage 0-100
}

interface MintersPanelProps {
    minters: Minter[];
}

export const MintersPanel: React.FC<MintersPanelProps> = ({ minters }) => {
    return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} width={22}>
            <Text bold color="cyan">MINTERS</Text>
            <Box marginTop={1} flexDirection="column">
                {minters.length === 0 ? (
                    <Text dimColor>No minters</Text>
                ) : (
                    minters.map((m, i) => (
                        <Box key={i} flexDirection="row">
                            <Text>{m.address.slice(0, 6)}...</Text>
                            <Text> </Text>
                            <Text color={m.quotaUsed > 80 ? 'red' : m.quotaUsed > 50 ? 'yellow' : 'green'}>
                                {renderBar(m.quotaUsed)} {m.quotaUsed}%
                            </Text>
                        </Box>
                    ))
                )}
            </Box>
        </Box>
    );
};

function renderBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
