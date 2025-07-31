import React from 'react';
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: 'white',
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
}));

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <LoadingContainer>
      <LogoContainer>
        <Typography variant="h3" component="h1" fontWeight="bold" sx={{ mb: 1 }}>
          CGPA Calculator
        </Typography>
      </LogoContainer>
      
      <Box sx={{ mb: 3 }}>
        <CircularProgress size={60} sx={{ color: 'white' }} />
      </Box>
      
      <Typography variant="h6" sx={{ mb: 2 }}>
        {message}
      </Typography>
      
      <Box sx={{ width: 300, mb: 2 }}>
        <LinearProgress 
          sx={{ 
            backgroundColor: 'rgba(255,255,255,0.3)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'white'
            }
          }} 
        />
      </Box>
      
      <Typography variant="body2" sx={{ opacity: 0.8 }}>
        Educational Management System
      </Typography>
    </LoadingContainer>
  );
};

export default LoadingScreen;