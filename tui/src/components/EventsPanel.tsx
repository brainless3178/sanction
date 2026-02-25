import React from 'react';
import { Box, Text } from 'ink';
import { EventEntry } from '../hooks/useEvents';

interface EventsPanelProps {
    events: EventEntry[];
}

const EVENT_COLORS: Record<string, string> = {
    'MINT': 'green',
    'BURN': 'red',
    'FREEZE': 'blue',
    'THAW': 'yellow',
    'BLACKLIST': 'redBright',
    'SEIZE': 'magenta',
    'PAUSE': 'yellowBright',
    'ROLE+': 'cyan',
    'ROLE-': 'gray',
};

export const EventsPanel: React.FC<EventsPanelProps> = ({ events }) => {
    return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} width={26}>
            <Text bold color="cyan">RECENT EVENTS</Text>
            <Box marginTop={1} flexDirection="column">
                {events.length === 0 ? (
                    <Text dimColor>No events yet...</Text>
                ) : (
                    events.slice(0, 10).map((e, i) => (
                        <Text key={i}>
                            <Text dimColor>{e.time}</Text>
                            {' '}
                            <Text color={EVENT_COLORS[e.type] || 'white'} bold>{e.type.padEnd(10)}</Text>
                            {' '}
                            <Text dimColor>{e.detail}</Text>
                        </Text>
                    ))
                )}
            </Box>
        </Box>
    );
};
